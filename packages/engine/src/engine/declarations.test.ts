/**
 * Targeted tests for the declaration-based / opening special rules (step 6,
 * items 5–9): 흔들기 / 폭탄 / 총통 / 쇼당. (멍따 is recorded only as an event +
 * state in step 6; its multiplier lands in step 7, so it has no turn-time test.)
 *
 * Card id reference (id = (month-1)*4 + slot):
 *   month 1: 0 광, 1 띠, 2 피, 3 피     month 2: 4 열끗, 5 띠, 6 피, 7 피
 */
import { describe, expect, it } from 'vitest';
import { createGame, getLegalActions, reduce } from './reduce.js';
import { resolveRuleConfig } from '../rules/presets.js';
import type { GameAction } from '../state/actions.js';
import type { GameEvent } from '../events/events.js';
import type {
  CapturedPile,
  FieldPiles,
  GameState,
  PlayerState,
  Seat,
} from '../state/game-state.js';
import type { CardId } from '../domain/card/card.js';
import type { RuleConfig } from '../rules/rule-config.js';

function player(seat: Seat, hand: CardId[]): PlayerState {
  const captured: CapturedPile = { brights: [], animals: [], ribbons: [], junk: [] };
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [...hand],
    captured,
    goCount: 0,
    lastGoScore: 0,
    hasShaken: false,
    shakenMonths: [],
    bombCount: 0,
    mungtta: false,
    showdownCount: 0,
    connected: true,
  };
}

function makeState(opts: {
  players: PlayerState[];
  field?: FieldPiles;
  drawPile?: CardId[];
  turn?: Seat;
  rule?: RuleConfig;
}): GameState {
  return {
    gameId: 't',
    seed: 't',
    rule: opts.rule ?? resolveRuleConfig('PMANG_NEWMATGO'),
    scoreEngineVersion: 1,
    phase: 'PLAYING',
    players: opts.players,
    dealer: 0,
    turn: opts.turn ?? 0,
    turnCount: 1,
    board: { field: opts.field ?? {} },
    drawPile: opts.drawPile ?? [],
    stakeMultiplier: 1,
    eventSeq: 0,
  };
}

describe('special rules — 흔들기 (shake)', () => {
  it('offers DECLARE_SHAKE for a 3-of-a-month hand, records it, then needs a play', () => {
    const state = makeState({ players: [player(0, [0, 1, 2, 4]), player(1, [5])] });
    const shake = getLegalActions(state).find((a) => a.type === 'DECLARE_SHAKE');
    expect(shake).toEqual({ type: 'DECLARE_SHAKE', seat: 0, month: 1 });

    const { state: next, events } = reduce(state, shake as GameAction);
    expect(events.map((e) => e.type)).toEqual(['ShakeDeclared']);
    const p0 = next.players[0]!;
    expect(p0.hasShaken).toBe(true);
    expect(p0.shakenMonths).toEqual([1]);

    // Same seat, still PLAYING; the month cannot be shaken twice.
    expect(next.turn).toBe(0);
    expect(next.phase).toBe('PLAYING');
    expect(getLegalActions(next).some((a) => a.type === 'DECLARE_SHAKE')).toBe(false);
    expect(getLegalActions(next).some((a) => a.type === 'PLAY_CARD')).toBe(true);
  });

  it('is disabled via RuleConfig', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { shaking: { enabled: false } } });
    const state = makeState({ players: [player(0, [0, 1, 2, 4]), player(1, [5])], rule });
    expect(getLegalActions(state).some((a) => a.type === 'DECLARE_SHAKE')).toBe(false);
  });
});

describe('special rules — 폭탄 (bomb)', () => {
  it('captures all four (3 hand + 1 field), keeps the turn, increments bombCount', () => {
    const state = makeState({
      players: [player(0, [1, 2, 3, 4]), player(1, [5])],
      field: { 1: [0] }, // one month-1 card to bomb onto
    });
    const bomb = getLegalActions(state).find((a) => a.type === 'PLAY_BOMB');
    expect(bomb).toEqual({ type: 'PLAY_BOMB', seat: 0, month: 1, cardIds: [1, 2, 3] });

    const { state: next, events } = reduce(state, bomb as GameAction);
    expect(events.map((e) => e.type)).toEqual(['BombDeclared', 'CardsCaptured']);

    const p0 = next.players[0]!;
    expect(p0.bombCount).toBe(1);
    expect(p0.hand).toEqual([4]); // the 3 bomb cards left the hand
    const capturedAll = [
      ...p0.captured.brights,
      ...p0.captured.animals,
      ...p0.captured.ribbons,
      ...p0.captured.junk,
    ].sort((a, b) => a - b);
    expect(capturedAll).toEqual([0, 1, 2, 3]);
    expect(next.board.field[1]).toBeUndefined();

    // Extra turn: still seat 0 (hand not empty).
    expect(next.turn).toBe(0);
    expect(next.phase).toBe('PLAYING');
  });

  it('is disabled via RuleConfig', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { bomb: { enabled: false } } });
    const state = makeState({ players: [player(0, [1, 2, 3, 4]), player(1, [5])], field: { 1: [0] }, rule });
    expect(getLegalActions(state).some((a) => a.type === 'PLAY_BOMB')).toBe(false);
  });
});

describe('special rules — 쇼당 (showdown)', () => {
  it('records ShowdownOccurred when play+flip match an occupied month', () => {
    const state = makeState({
      players: [player(0, [2]), player(1, [5])],
      field: { 1: [1] }, // month-1 already on field
      drawPile: [3], // flip is month-1 too → 뻑 + 쇼당
    });
    const { state: next, events } = reduce(state, { type: 'PLAY_CARD', seat: 0, cardId: 2 });
    const types = events.map((e) => e.type);
    expect(types).toContain('ShowdownOccurred');
    expect(types).toContain('PpeokOccurred');
    expect(next.players[0]!.showdownCount).toBe(1);
  });

  it('is disabled via RuleConfig (still 뻑, but no 쇼당 record)', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { showdown: { enabled: false } } });
    const state = makeState({
      players: [player(0, [2]), player(1, [5])],
      field: { 1: [1] },
      drawPile: [3],
      rule,
    });
    const events = reduce(state, { type: 'PLAY_CARD', seat: 0, cardId: 2 }).events;
    expect(events.map((e) => e.type)).not.toContain('ShowdownOccurred');
    expect(events.map((e) => e.type)).toContain('PpeokOccurred');
  });
});

describe('special rules — 총통 (chongtong)', () => {
  it('a 4-of-a-month opening hand ends the game instantly, recorded separately from GameEnded', () => {
    // Scan seeds until a deal produces 총통 (≈2.6% per game → found quickly).
    let found = false;
    for (let i = 0; i < 5000 && !found; i++) {
      const { state, events } = createGame({
        gameId: 'g',
        seed: `chong-${i}`,
        players: [
          { seat: 0, playerId: 'A', isAi: false },
          { seat: 1, playerId: 'B', isAi: false },
        ],
      });
      const chong = events.find((e) => e.type === 'ChongtongDeclared');
      if (!chong) continue;
      found = true;

      const idxChong = events.findIndex((e) => e.type === 'ChongtongDeclared');
      const idxEnd = events.findIndex((e) => e.type === 'GameEnded');
      // 총통 is its own event, emitted strictly before GameEnded.
      expect(idxChong).toBeGreaterThanOrEqual(0);
      expect(idxEnd).toBeGreaterThan(idxChong);
      // No TurnStarted: the game never begins play.
      expect(events.some((e) => e.type === 'TurnStarted')).toBe(false);

      const c = chong as Extract<GameEvent, { type: 'ChongtongDeclared' }>;
      expect(state.phase).toBe('FINISHED');
      expect(state.winner).toBe(c.seat);
      expect(state.finalScore).toBe(c.score);
    }
    expect(found).toBe(true);
  });

  it('is disabled via RuleConfig (no instant win)', () => {
    // Find a 총통 seed, then verify disabling chongtong starts a normal game.
    let seed: string | null = null;
    for (let i = 0; i < 5000 && seed === null; i++) {
      const { events } = createGame({
        gameId: 'g',
        seed: `chong-${i}`,
        players: [
          { seat: 0, playerId: 'A', isAi: false },
          { seat: 1, playerId: 'B', isAi: false },
        ],
      });
      if (events.some((e) => e.type === 'ChongtongDeclared')) seed = `chong-${i}`;
    }
    expect(seed).not.toBeNull();

    const { state, events } = createGame({
      gameId: 'g',
      seed: seed!,
      players: [
        { seat: 0, playerId: 'A', isAi: false },
        { seat: 1, playerId: 'B', isAi: false },
      ],
      ruleOverrides: { special: { chongtong: { enabled: false } } },
    });
    expect(events.some((e) => e.type === 'ChongtongDeclared')).toBe(false);
    expect(events.some((e) => e.type === 'TurnStarted')).toBe(true);
    expect(state.phase).toBe('PLAYING');
  });
});
