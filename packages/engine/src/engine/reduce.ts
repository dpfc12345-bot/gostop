/**
 * GameEngine core: createGame (genesis), reduce (turn FSM), getLegalActions.
 *
 * Hard invariants:
 *   - reduce NEVER mutates state and NEVER builds the next state by hand. It
 *     only emits events and folds them via applyEvent (the `emit` closure).
 *     Therefore reduce ≡ replay(events) by construction.
 *   - reduce validates every action against getLegalActions first (server
 *     authority / anti-cheat). Illegal actions throw EngineError.
 *
 * Step 5 implements 2-player 맞고 (PMANG_NEWMATGO) mechanics: deal → play →
 * capture (0/1/2/3 field matches; 2 ⇒ player choice) → flip from deck → resolve
 * → next turn → end when hands are empty. Scoring (go/stop gate) and special
 * rules are reached only through injected stubs (steps 6–7).
 */
import type { CardId, Month } from '../domain/card/card.js';
import { getCard, ORDERED_CARD_IDS } from '../domain/card/deck.js';
import { createSeededRng, shuffle } from '../rng/rng.js';
import { resolveRuleConfig } from '../rules/presets.js';
import type { DeepPartial, RuleConfig, RulePreset } from '../rules/rule-config.js';
import type { RuleResult } from '../rules/rule-engine.js';
import type { GameAction } from '../state/actions.js';
import type { GameState, Seat } from '../state/game-state.js';
import type { ReduceResult } from '../state/reducer.js';
import type { GameEvent, Settlement } from '../events/events.js';
import { applyEvent, initialStateForReplay } from './apply-event.js';
import { SCORE_ENGINE_VERSION } from '../scoring/score-engine.js';
import { defaultDeps, type EngineDeps } from './deps.js';
import { EngineError } from './errors.js';
import { stableStringify } from './hash.js';

interface Ctx {
  state: GameState;
  events: GameEvent[];
}

type Emit = (event: GameEvent) => void;

function makeCtx(state: GameState): { ctx: Ctx; emit: Emit } {
  const ctx: Ctx = { state, events: [] };
  const emit: Emit = (event) => {
    ctx.events.push(event);
    ctx.state = applyEvent(ctx.state, event);
  };
  return { ctx, emit };
}

// ── Genesis ────────────────────────────────────────────────────────────────

export interface CreateGameParams {
  gameId: string;
  seed: string;
  players: { seat: Seat; playerId: string; isAi: boolean }[];
  preset?: RulePreset;
  ruleOverrides?: DeepPartial<RuleConfig>;
  /** Override the ScoreEngine version (defaults to the current one). */
  scoreEngineVersion?: number;
}

export function createGame(params: CreateGameParams): ReduceResult {
  const rule = resolveRuleConfig(params.preset ?? 'PMANG_NEWMATGO', params.ruleOverrides);
  const scoreEngineVersion = params.scoreEngineVersion ?? SCORE_ENGINE_VERSION;
  const players = [...params.players].sort((a, b) => a.seat - b.seat);
  const pc = players.length;

  const rng = createSeededRng(params.seed);
  const dealer = rng.nextInt(pc);
  const deck = shuffle(ORDERED_CARD_IDS, rng);

  const { handSize, fieldSize } = rule.deal;
  const hands = new Map<Seat, CardId[]>(players.map((p) => [p.seat, []]));
  let idx = 0;
  for (let round = 0; round < handSize; round++) {
    for (let k = 0; k < pc; k++) {
      const seat = (dealer + k) % pc;
      hands.get(seat)!.push(deck[idx++]!);
    }
  }
  const field = deck.slice(idx, idx + fieldSize);
  idx += fieldSize;
  const drawPile = deck.slice(idx);

  const { ctx, emit } = makeCtx(initialStateForReplay());
  emit({
    type: 'GameCreated',
    gameId: params.gameId,
    seed: params.seed,
    rule,
    scoreEngineVersion,
    players,
    dealer,
  });
  emit({
    type: 'CardsDealt',
    hands: players.map((p) => ({ seat: p.seat, cardIds: hands.get(p.seat)! })),
    field,
    drawPile,
    drawPileCount: drawPile.length,
  });

  // 총통 — 4-of-a-month in any opening hand is an instant win. Recorded as a
  // dedicated event BEFORE GameEnded (per requirements), scanning dealer-first.
  if (rule.special.chongtong.enabled) {
    for (let k = 0; k < pc; k++) {
      const seat = (dealer + k) % pc;
      const month = findFourOfAMonth(hands.get(seat)!);
      if (month !== null) {
        const score = rule.special.chongtong.score;
        emit({ type: 'ChongtongDeclared', seat, month, score });
        emit({ type: 'GameEnded', winner: seat, score, settlement: [] });
        return { state: ctx.state, events: ctx.events };
      }
    }
  }

  emit({ type: 'TurnStarted', seat: dealer, turnCount: 1 });

  return { state: ctx.state, events: ctx.events };
}

/** Returns the month for which the hand holds all four cards, or null. */
function findFourOfAMonth(hand: readonly CardId[]): Month | null {
  const counts = new Map<Month, number>();
  for (const id of hand) {
    const month = getCard(id).month;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  for (const [month, n] of counts) {
    if (n === 4) return month;
  }
  return null;
}

// ── Legal actions (server authority) ─────────────────────────────────────────

export function getLegalActions(state: GameState): GameAction[] {
  if (state.phase === 'FINISHED') return [];

  const pending = state.pending;
  if (pending) {
    switch (pending.kind) {
      case 'GO_OR_STOP':
        return [
          { type: 'DECLARE_GO', seat: pending.seat },
          { type: 'DECLARE_STOP', seat: pending.seat },
        ];
      case 'CHOOSE_MATCH':
        return pending.candidates.map((c) => ({
          type: 'CHOOSE_MATCH',
          seat: pending.seat,
          targetCardId: c,
        }));
      case 'CHOOSE_KUKJIN':
        return [
          { type: 'CHOOSE_KUKJIN', seat: pending.seat, asDoubleJunk: true },
          { type: 'CHOOSE_KUKJIN', seat: pending.seat, asDoubleJunk: false },
        ];
      case 'SHAKE_CONFIRM':
      case 'SHOWDOWN':
        return [];
    }
  }

  if (state.phase === 'PLAYING') {
    const seat = state.turn;
    const player = state.players.find((p) => p.seat === seat);
    if (!player) return [];

    // PLAY_CARD listed FIRST so the deterministic "first legal action" driver is
    // unaffected by the optional declarations below.
    const actions: GameAction[] = player.hand.map((cardId) => ({ type: 'PLAY_CARD', seat, cardId }));

    const counts = monthCounts(player.hand);

    // 흔들기 — 3-of-a-month in hand, declarable once per month, before playing.
    if (state.rule.special.shaking.enabled) {
      for (const [month, ids] of counts) {
        if (ids.length >= 3 && !player.shakenMonths.includes(month)) {
          actions.push({ type: 'DECLARE_SHAKE', seat, month });
        }
      }
    }

    // 폭탄 — exactly 3-of-a-month in hand AND at least one on the field.
    if (state.rule.special.bomb.enabled) {
      for (const [month, ids] of counts) {
        if (ids.length === 3 && (state.board.field[month]?.length ?? 0) >= 1) {
          actions.push({ type: 'PLAY_BOMB', seat, month, cardIds: [...ids].sort((a, b) => a - b) });
        }
      }
    }

    return actions;
  }

  return [];
}

/** Group a hand's card ids by month. */
function monthCounts(hand: readonly CardId[]): Map<Month, CardId[]> {
  const map = new Map<Month, CardId[]>();
  for (const id of hand) {
    const month = getCard(id).month;
    const list = map.get(month);
    if (list) list.push(id);
    else map.set(month, [id]);
  }
  return map;
}

function assertLegal(state: GameState, action: GameAction): void {
  const key = stableStringify(action);
  const legal = getLegalActions(state);
  if (!legal.some((l) => stableStringify(l) === key)) {
    throw new EngineError('ILLEGAL_ACTION', `illegal action in phase ${state.phase}: ${key}`);
  }
}

// ── Turn mechanics ───────────────────────────────────────────────────────────

/**
 * Next seat (cyclically after `from`) that still holds cards, or null if none.
 * Skipping empty hands keeps the game well-formed when 폭탄 desyncs hand counts.
 */
function nextPlayableSeat(state: GameState, from: Seat): Seat | null {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    const p = state.players.find((pl) => pl.seat === seat);
    if (p && p.hand.length > 0) return seat;
  }
  return null;
}

function advanceOrEnd(ctx: Ctx, emit: Emit, seat: Seat): void {
  const next = nextPlayableSeat(ctx.state, seat);
  if (next === null) {
    emit({ type: 'GameEnded', winner: null, score: 0, settlement: [] });
    return;
  }
  emit({ type: 'TurnStarted', seat: next, turnCount: ctx.state.turnCount + 1 });
}

function endTurn(ctx: Ctx, emit: Emit, deps: EngineDeps): void {
  const seat = ctx.state.turn;
  const player = ctx.state.players.find((p) => p.seat === seat);

  // 고/스톱 gate: only offered when the score reaches the threshold AND has
  // increased since this player's last 고 (so they aren't re-asked for nothing).
  const result = deps.score.evaluate(ctx.state, seat);
  if (
    player &&
    result.total >= ctx.state.rule.go.minScoreToFinish &&
    result.total > player.lastGoScore
  ) {
    emit({ type: 'ScoreEvaluated', seat, score: result.total, breakdown: result.breakdown });
    emit({ type: 'GoStopRequired', seat, score: result.total });
    return;
  }

  advanceOrEnd(ctx, emit, seat);
}

/** Translate a RuleEngine result into events (events are emitted ONLY here). */
function findKukjinCaptured(cardIds: readonly CardId[]): CardId | undefined {
  return cardIds.find((id) => getCard(id).isKukjin === true);
}

function afterCapturesMaybeKukjin(
  ctx: Ctx,
  emit: Emit,
  deps: EngineDeps,
  seat: Seat,
  capturedIds: readonly CardId[],
  after: 'END_TURN' | 'STAY',
  then: () => void,
): void {
  if (ctx.state.rule.scoring.kukjin !== 'PLAYER_CHOICE') {
    then();
    return;
  }
  const kukjinId = findKukjinCaptured(capturedIds);
  if (kukjinId === undefined) {
    then();
    return;
  }
  emit({ type: 'KukjinChoiceRequired', seat, cardId: kukjinId, after });
  void deps;
}

function applyPlan(
  ctx: Ctx,
  emit: Emit,
  deps: EngineDeps,
  seat: Seat,
  playedCardId: CardId,
  plan: RuleResult,
): void {
  if (plan.kind === 'NEED_CHOICE') {
    emit({
      type: 'MatchChoiceRequired',
      seat,
      playedCardId,
      month: plan.month,
      candidates: plan.candidates,
      choices: plan.choices,
    });
    return;
  }

  const r = plan.resolution;
  emit({ type: 'PlayerPlayedCard', seat, cardId: playedCardId });
  if (r.flippedCardId !== null) {
    emit({ type: 'CardFlippedFromDeck', seat, cardId: r.flippedCardId });
  }
  for (const id of r.placed) {
    emit({ type: 'CardPlacedOnField', seat, cardId: id, source: id === playedCardId ? 'HAND' : 'FLIP' });
  }
  if (r.showdownMonth !== null) {
    emit({ type: 'ShowdownOccurred', seat, month: r.showdownMonth });
  }
  if (r.ppeokMonth !== null) {
    emit({ type: 'PpeokOccurred', seat, month: r.ppeokMonth });
  }
  for (const cap of r.captures) {
    emit({ type: 'CardsCaptured', seat, cardIds: cap.cardIds, cause: cap.cause });
  }
  for (const st of r.steals) {
    emit({ type: 'JunkStolen', fromSeat: st.fromSeat, toSeat: st.toSeat, cardId: st.cardId, cause: st.cause });
  }
  const capturedIds = r.captures.flatMap((cap) => cap.cardIds);
  afterCapturesMaybeKukjin(ctx, emit, deps, seat, capturedIds, 'END_TURN', () => endTurn(ctx, emit, deps));
}

/** 흔들기 — a pre-play declaration; it does not consume the turn. */
function handleShake(emit: Emit, seat: Seat, month: Month): void {
  // Phase stays PLAYING for the same seat; the player still plays a card next.
  emit({ type: 'ShakeDeclared', seat, month });
}

/**
 * 폭탄 — slam 3 same-month cards onto the field's match and take all four. The
 * deck is NOT flipped and the turn does NOT pass (the player gets to act again),
 * unless their hand is now exhausted.
 */
function handleBomb(
  ctx: Ctx,
  emit: Emit,
  deps: EngineDeps,
  seat: Seat,
  month: Month,
  cardIds: readonly CardId[],
): void {
  const fieldMonth = ctx.state.board.field[month] ?? [];
  emit({ type: 'BombDeclared', seat, month, cardIds: [...cardIds] });
  const capturedIds = [...cardIds, ...fieldMonth];
  emit({ type: 'CardsCaptured', seat, cardIds: capturedIds, cause: 'BONUS' });

  afterCapturesMaybeKukjin(ctx, emit, deps, seat, capturedIds, 'STAY', () => {
    const me = ctx.state.players.find((p) => p.seat === seat);
    if (me && me.hand.length === 0) {
      advanceOrEnd(ctx, emit, seat);
    }
  });
}

function handlePlay(ctx: Ctx, emit: Emit, deps: EngineDeps, seat: Seat, cardId: CardId): void {
  const plan = deps.rules.planTurn(ctx.state, { seat, playedCardId: cardId, choices: {} });
  applyPlan(ctx, emit, deps, seat, cardId, plan);
}

function handleResume(ctx: Ctx, emit: Emit, deps: EngineDeps, targetCardId: CardId): void {
  const pending = ctx.state.pending;
  if (!pending || pending.kind !== 'CHOOSE_MATCH') {
    throw new EngineError('ILLEGAL_STATE', 'no match choice pending');
  }
  const choices = { ...pending.choices, [pending.month]: targetCardId };
  const plan = deps.rules.planTurn(ctx.state, {
    seat: pending.seat,
    playedCardId: pending.playedCardId,
    choices,
  });
  applyPlan(ctx, emit, deps, pending.seat, pending.playedCardId, plan);
}

function handleKukjin(ctx: Ctx, emit: Emit, deps: EngineDeps, asDoubleJunk: boolean): void {
  const pending = ctx.state.pending;
  if (!pending || pending.kind !== 'CHOOSE_KUKJIN') {
    throw new EngineError('ILLEGAL_STATE', 'no kukjin choice pending');
  }
  emit({ type: 'KukjinDeclared', seat: pending.seat, cardId: pending.cardId, asDoubleJunk });
  if (pending.after === 'END_TURN') {
    endTurn(ctx, emit, deps);
  }
}

function handleGo(ctx: Ctx, emit: Emit): void {
  const pending = ctx.state.pending;
  if (!pending || pending.kind !== 'GO_OR_STOP') {
    throw new EngineError('ILLEGAL_STATE', 'no go/stop pending');
  }
  const seat = pending.seat;
  const player = ctx.state.players.find((p) => p.seat === seat)!;
  emit({ type: 'GoSelected', seat, goCount: player.goCount + 1, score: pending.currentScore });
  advanceOrEnd(ctx, emit, seat);
}

function handleStop(ctx: Ctx, emit: Emit, deps: EngineDeps): void {
  const pending = ctx.state.pending;
  if (!pending || pending.kind !== 'GO_OR_STOP') {
    throw new EngineError('ILLEGAL_STATE', 'no go/stop pending');
  }
  const seat = pending.seat;

  // Final scoring INCLUDING 박 (depends on the opponent), recorded for replay.
  const breakdown = deps.score.settle(ctx.state, seat);
  emit({ type: 'ScoreEvaluated', seat, score: breakdown.total, breakdown });
  emit({ type: 'StopSelected', seat, score: breakdown.total });

  const settlement = buildSettlement(ctx.state, seat, breakdown.total);
  emit({ type: 'GameEnded', winner: seat, score: breakdown.total, settlement });
}

/** Winner receives `total × stake` from each loser; losers each pay it. */
function buildSettlement(state: GameState, winner: Seat, total: number): Settlement[] {
  const stake = state.stakeMultiplier;
  const losers = state.players.filter((p) => p.seat !== winner);
  const amount = total * stake;
  return [
    { seat: winner, amount: amount * losers.length },
    ...losers.map((l) => ({ seat: l.seat, amount: -amount })),
  ];
}

export function reduce(
  state: GameState,
  action: GameAction,
  deps: EngineDeps = defaultDeps,
): ReduceResult {
  assertLegal(state, action);
  const { ctx, emit } = makeCtx(state);

  switch (action.type) {
    case 'PLAY_CARD':
      handlePlay(ctx, emit, deps, action.seat, action.cardId);
      break;
    case 'CHOOSE_MATCH':
      handleResume(ctx, emit, deps, action.targetCardId);
      break;
    case 'DECLARE_SHAKE':
      handleShake(emit, action.seat, action.month);
      break;
    case 'PLAY_BOMB':
      handleBomb(ctx, emit, deps, action.seat, action.month, action.cardIds);
      break;
    case 'CHOOSE_KUKJIN':
      handleKukjin(ctx, emit, deps, action.asDoubleJunk);
      break;
    case 'DECLARE_GO':
      handleGo(ctx, emit);
      break;
    case 'DECLARE_STOP':
      handleStop(ctx, emit, deps);
      break;
  }

  return { state: ctx.state, events: ctx.events };
}
