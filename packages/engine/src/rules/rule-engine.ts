/**
 * RuleEngine — PURE decision module. It NEVER creates events and NEVER mutates
 * state; it returns a `RuleResult` describing what should happen this turn. The
 * reduce layer is solely responsible for turning that result into events.
 *
 * `planTurn` resolves the full hand-play + deck-flip interaction for one turn,
 * including the capture-derived specials (step 6, items 1–4):
 *   - 뻑 (ppeok)     : play matches 1, flip is the same month → 3 stack, take none
 *   - 따닥 (ttakdak)  : hand and flip each capture (different months) → steal 1 pi
 *   - 쪽 (jjok)       : play to empty month, flip matches it → capture both, steal 1 pi
 *   - 싹쓸이 (ssaksseuli) : the field is emptied by your captures → steal 1 pi
 *
 * All four are individually toggled by `RuleConfig.special`. The function is
 * re-entrant: a 2-card field match needs a player CHOICE, returned as
 * NEED_CHOICE; the caller re-invokes with the accumulated `choices`.
 */
import { getCard } from '../domain/card/deck.js';
import { junkValueOf } from '../domain/card/card.js';
import type { CardId, Month } from '../domain/card/card.js';
import type { ChoiceMap, GameState, Seat } from '../state/game-state.js';

export type CaptureCause = 'HAND_MATCH' | 'FLIP_MATCH' | 'PPEOK_CLEAR' | 'BONUS';
export type StealCause = 'JJOK' | 'SSAKSSEULI' | 'PPEOK' | 'BOMB' | 'TTAKDAK';

export interface CaptureGroup {
  cause: CaptureCause;
  cardIds: CardId[];
}

export interface StealSpec {
  fromSeat: Seat;
  toSeat: Seat;
  cardId: CardId;
  cause: StealCause;
}

export interface TurnResolution {
  flippedCardId: CardId | null;
  /** Active cards (played/flipped) that remain on the field (placed or 뻑). */
  placed: CardId[];
  /** Capture groups for the acting seat (active card + matched field cards). */
  captures: CaptureGroup[];
  ppeokMonth: Month | null;
  /** 쇼당 — set when played+flipped matched the same already-occupied month. */
  showdownMonth: Month | null;
  steals: StealSpec[];
}

export type RuleResult =
  | { kind: 'NEED_CHOICE'; month: Month; candidates: CardId[]; choices: ChoiceMap }
  | { kind: 'RESOLVED'; resolution: TurnResolution };

export interface TurnInput {
  seat: Seat;
  playedCardId: CardId;
  choices: ChoiceMap;
}

export interface RuleEngine {
  planTurn(state: GameState, input: TurnInput): RuleResult;
}

function fieldOf(state: GameState, month: Month): CardId[] {
  return state.board.field[month] ?? [];
}

/** Deterministically steal up to one junk card from each opponent. */
function buildSteals(
  state: GameState,
  actorSeat: Seat,
  cause: StealCause,
  exclude: Set<CardId>,
): StealSpec[] {
  const specs: StealSpec[] = [];
  for (const opp of state.players) {
    if (opp.seat === actorSeat) continue;
    const junk = opp.captured.junk;
    let pick = junk.find((id) => !exclude.has(id) && junkValueOf(getCard(id)) === 1);
    if (pick === undefined) pick = junk.find((id) => !exclude.has(id));
    if (pick !== undefined) {
      exclude.add(pick);
      specs.push({ fromSeat: opp.seat, toSeat: actorSeat, cardId: pick, cause });
    }
  }
  return specs;
}

interface Partial {
  flippedCardId: CardId | null;
  placed: CardId[];
  captures: CaptureGroup[];
  ppeokMonth: Month | null;
  showdownMonth: Month | null;
  baseSteals: StealSpec[];
}

/** Finalise a resolution, appending 싹쓸이 if the field ends up empty. */
function finalize(state: GameState, seat: Seat, part: Partial): RuleResult {
  const allFieldIds = Object.values(state.board.field).flatMap((ids) => ids ?? []);
  const captured = new Set(part.captures.flatMap((c) => c.cardIds));
  let remaining = allFieldIds.filter((id) => !captured.has(id)).length;
  remaining += part.placed.length;

  const hasCapture = part.captures.length > 0;
  const exclude = new Set(part.baseSteals.map((s) => s.cardId));
  let steals = part.baseSteals;
  if (state.rule.special.ssakSseuli.enabled && hasCapture && remaining === 0) {
    steals = [...steals, ...buildSteals(state, seat, 'SSAKSSEULI', exclude)];
  }

  return {
    kind: 'RESOLVED',
    resolution: {
      flippedCardId: part.flippedCardId,
      placed: part.placed,
      captures: part.captures,
      ppeokMonth: part.ppeokMonth,
      showdownMonth: part.showdownMonth,
      steals,
    },
  };
}

export function createRuleEngine(): RuleEngine {
  function planTurn(state: GameState, input: TurnInput): RuleResult {
    const special = state.rule.special;
    const { seat, playedCardId: played, choices } = input;
    const mP = getCard(played).month;

    const drawPile = state.drawPile;
    const flipped = drawPile.length > 0 ? drawPile[drawPile.length - 1]! : null;
    const mF = flipped !== null ? getCard(flipped).month : null;

    const groupP = fieldOf(state, mP);

    // ── Case A: flip exists and is the SAME month as the played card ──────────
    if (flipped !== null && mF === mP) {
      const a = groupP.length;
      if (a === 0) {
        // 쪽 — played to an empty month, flip matches it.
        const baseSteals = special.jjok.enabled
          ? buildSteals(state, seat, 'JJOK', new Set<CardId>())
          : [];
        return finalize(state, seat, {
          flippedCardId: flipped,
          placed: [],
          captures: [{ cause: 'FLIP_MATCH', cardIds: [played, flipped] }],
          ppeokMonth: null,
          showdownMonth: null,
          baseSteals,
        });
      }
      // 쇼당 — played + flipped match a month already on the field (a ≥ 1).
      const showdownMonth = special.showdown.enabled ? mP : null;
      if (a === 1 && special.ppeok.enabled) {
        // 뻑 — three of the month stack on the field; take nothing.
        return finalize(state, seat, {
          flippedCardId: flipped,
          placed: [played, flipped],
          captures: [],
          ppeokMonth: mP,
          showdownMonth,
          baseSteals: [],
        });
      }
      // a === 2 (take all four) or 뻑 disabled (take all three).
      return finalize(state, seat, {
        flippedCardId: flipped,
        placed: [],
        captures: [{ cause: 'FLIP_MATCH', cardIds: [played, ...groupP, flipped] }],
        ppeokMonth: null,
        showdownMonth,
        baseSteals: [],
      });
    }

    // ── Case B: different months (or no flip) ─────────────────────────────────
    let handCapture: CardId[] | null = null;
    let handPlaced = false;
    const aP = groupP.length;
    if (aP === 0) {
      handPlaced = true;
    } else if (aP === 1) {
      handCapture = [played, groupP[0]!];
    } else if (aP === 2) {
      const chosen = choices[mP];
      if (chosen === undefined) {
        return { kind: 'NEED_CHOICE', month: mP, candidates: [...groupP], choices };
      }
      handCapture = [played, chosen];
    } else {
      handCapture = [played, ...groupP];
    }

    let flipCapture: CardId[] | null = null;
    let flipPlaced = false;
    if (flipped !== null && mF !== null) {
      const groupF = fieldOf(state, mF);
      const bF = groupF.length;
      if (bF === 0) {
        flipPlaced = true;
      } else if (bF === 1) {
        flipCapture = [flipped, groupF[0]!];
      } else if (bF === 2) {
        const chosen = choices[mF];
        if (chosen === undefined) {
          return { kind: 'NEED_CHOICE', month: mF, candidates: [...groupF], choices };
        }
        flipCapture = [flipped, chosen];
      } else {
        flipCapture = [flipped, ...groupF];
      }
    }

    const placed: CardId[] = [];
    if (handPlaced) placed.push(played);
    if (flipPlaced && flipped !== null) placed.push(flipped);

    const captures: CaptureGroup[] = [];
    if (handCapture) captures.push({ cause: 'HAND_MATCH', cardIds: handCapture });
    if (flipCapture) captures.push({ cause: 'FLIP_MATCH', cardIds: flipCapture });

    // 따닥 — hand and flip both captured (distinct months).
    const baseSteals: StealSpec[] =
      handCapture && flipCapture && special.ttakDak.enabled
        ? buildSteals(state, seat, 'TTAKDAK', new Set<CardId>())
        : [];

    return finalize(state, seat, {
      flippedCardId: flipped,
      placed,
      captures,
      ppeokMonth: null,
      showdownMonth: null,
      baseSteals,
    });
  }

  return { planTurn };
}

export const defaultRuleEngine: RuleEngine = createRuleEngine();
