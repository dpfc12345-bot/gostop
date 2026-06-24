/**
 * Targeted tests for the capture-derived special rules (step 6, items 1–4):
 * 뻑 / 따닥 / 쪽 / 싹쓸이. Each is driven from a hand-crafted GameState so the
 * outcome is deterministic, and each is verified to be RuleConfig-toggleable.
 *
 * Card id reference (id = (month-1)*4 + slot):
 *   month 1: 0 광, 1 띠(홍단), 2 피, 3 피
 *   month 2: 4 열끗(고도리), 5 띠(홍단), 6 피, 7 피
 *   month 3: 8 광, 9 띠(홍단), 10 피, 11 피
 */
import { describe, expect, it } from 'vitest';
import { reduce } from './reduce.js';
import { resolveRuleConfig } from '../rules/presets.js';
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

function emptyPile(): CapturedPile {
  return { brights: [], animals: [], ribbons: [], junk: [] };
}

function player(seat: Seat, hand: CardId[], junk: CardId[] = []): PlayerState {
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [...hand],
    captured: { ...emptyPile(), junk: [...junk] },
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

function play(state: GameState, seat: Seat, cardId: CardId): GameEvent[] {
  return reduce(state, { type: 'PLAY_CARD', seat, cardId }).events;
}

function typesOf(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('special rules — 쪽 (jjok)', () => {
  it('play to empty month + flip matches it → capture both and steal a 피', () => {
    const state = makeState({
      players: [player(0, [2]), player(1, [10], [7])],
      field: { 2: [4] }, // unrelated month keeps the field non-empty (no 싹쓸이)
      drawPile: [3], // top (last) is month-1 card → matches the played card 2
    });
    const events = play(state, 0, 2);

    const captured = events.filter((e) => e.type === 'CardsCaptured');
    expect(captured).toHaveLength(1);
    expect((captured[0] as Extract<GameEvent, { type: 'CardsCaptured' }>).cardIds.sort()).toEqual([
      2, 3,
    ]);

    const steals = events.filter((e) => e.type === 'JunkStolen');
    expect(steals).toHaveLength(1);
    const steal = steals[0] as Extract<GameEvent, { type: 'JunkStolen' }>;
    expect(steal.cause).toBe('JJOK');
    expect(steal.cardId).toBe(7);
    expect(steal.fromSeat).toBe(1);
    expect(steal.toSeat).toBe(0);

    expect(typesOf(events)).not.toContain('PpeokOccurred');
  });

  it('disabled via RuleConfig → still captures but no steal', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { jjok: { enabled: false } } });
    const state = makeState({
      players: [player(0, [2]), player(1, [10], [7])],
      field: { 2: [4] },
      drawPile: [3],
      rule,
    });
    const events = play(state, 0, 2);

    expect(events.filter((e) => e.type === 'CardsCaptured')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'JunkStolen')).toHaveLength(0);
  });
});

describe('special rules — 뻑 (ppeok)', () => {
  it('play matches 1 + flip is the same month → 3 stack, capture nothing', () => {
    const state = makeState({
      players: [player(0, [2]), player(1, [10])],
      field: { 1: [1] }, // one month-1 card already on the field
      drawPile: [3], // flip is also month-1
    });
    const events = play(state, 0, 2);

    expect(typesOf(events)).toContain('PpeokOccurred');
    const ppeok = events.find((e) => e.type === 'PpeokOccurred') as Extract<
      GameEvent,
      { type: 'PpeokOccurred' }
    >;
    expect(ppeok.month).toBe(1);

    // Both active cards stay on the field; nothing is captured.
    const placed = events.filter((e) => e.type === 'CardPlacedOnField');
    expect(placed.map((e) => (e as Extract<GameEvent, { type: 'CardPlacedOnField' }>).cardId).sort()).toEqual([2, 3]);
    expect(events.filter((e) => e.type === 'CardsCaptured')).toHaveLength(0);
  });

  it('disabled via RuleConfig → captures all three instead of stacking', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { ppeok: { enabled: false } } });
    const state = makeState({
      players: [player(0, [2]), player(1, [10])],
      field: { 1: [1] },
      drawPile: [3],
      rule,
    });
    const events = play(state, 0, 2);

    expect(typesOf(events)).not.toContain('PpeokOccurred');
    const captured = events.filter((e) => e.type === 'CardsCaptured');
    expect(captured).toHaveLength(1);
    expect((captured[0] as Extract<GameEvent, { type: 'CardsCaptured' }>).cardIds.sort()).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('special rules — 따닥 (ttakdak)', () => {
  it('hand and flip each capture (different months) → steal a 피', () => {
    const state = makeState({
      players: [player(0, [2]), player(1, [11], [7])],
      // month-1 + month-2 pairs to capture; month-3 stays so the field is not swept.
      field: { 1: [1], 2: [5], 3: [9] },
      drawPile: [6], // flip is month-2 → captures with field card 5
    });
    const events = play(state, 0, 2); // play month-1 → captures with field card 1

    const captured = events.filter((e) => e.type === 'CardsCaptured');
    expect(captured).toHaveLength(2);

    const steals = events.filter((e) => e.type === 'JunkStolen');
    expect(steals).toHaveLength(1);
    expect((steals[0] as Extract<GameEvent, { type: 'JunkStolen' }>).cause).toBe('TTAKDAK');
  });

  it('disabled via RuleConfig → captures both but no steal', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { special: { ttakDak: { enabled: false } } });
    const state = makeState({
      players: [player(0, [2]), player(1, [11], [7])],
      field: { 1: [1], 2: [5], 3: [9] },
      drawPile: [6],
      rule,
    });
    const events = play(state, 0, 2);

    expect(events.filter((e) => e.type === 'CardsCaptured')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'JunkStolen')).toHaveLength(0);
  });
});

describe('special rules — 싹쓸이 (ssaksseuli)', () => {
  it('emptying the field → steal a 피 from the opponent', () => {
    const state = makeState({
      players: [player(0, [2]), player(1, [10], [7])],
      field: { 1: [1] }, // the only field card; capturing it empties the field
      drawPile: [], // no flip
    });
    const events = play(state, 0, 2);

    const captured = events.filter((e) => e.type === 'CardsCaptured');
    expect(captured).toHaveLength(1);

    const steals = events.filter((e) => e.type === 'JunkStolen');
    expect(steals).toHaveLength(1);
    expect((steals[0] as Extract<GameEvent, { type: 'JunkStolen' }>).cause).toBe('SSAKSSEULI');
  });

  it('disabled via RuleConfig → no steal even when the field is cleared', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', {
      special: { ssakSseuli: { enabled: false } },
    });
    const state = makeState({
      players: [player(0, [2]), player(1, [10], [7])],
      field: { 1: [1] },
      drawPile: [],
      rule,
    });
    const events = play(state, 0, 2);

    expect(events.filter((e) => e.type === 'CardsCaptured')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'JunkStolen')).toHaveLength(0);
  });
});
