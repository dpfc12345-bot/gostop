import { describe, expect, it } from 'vitest';
import { projectView } from './projection.js';
import type { CapturedPile, GameState, PlayerState } from './game-state.js';
import { resolveRuleConfig } from '../rules/presets.js';

const emptyPile = (): CapturedPile => ({ brights: [], animals: [], ribbons: [], junk: [] });

const player = (seat: number, hand: number[], over: Partial<PlayerState> = {}): PlayerState => ({
  seat,
  playerId: `p${seat}`,
  isAi: false,
  hand,
  captured: emptyPile(),
  goCount: 0,
  hasShaken: false,
  shakenMonths: [],
  bombCount: 0,
  connected: true,
  ...over,
});

const baseState = (): GameState => ({
  gameId: 'g1',
  seed: 'seed-1',
  rule: resolveRuleConfig('PMANG_NEWMATGO'),
  phase: 'PLAYING',
  players: [player(0, [0, 1, 2]), player(1, [10, 11, 12, 13])],
  dealer: 0,
  turn: 0,
  turnCount: 1,
  board: { field: { 5: [20], 7: [28, 29] } },
  drawPile: [40, 41, 42, 43, 44],
  stakeMultiplier: 1,
  eventSeq: 3,
});

describe('projectView (hidden information firewall)', () => {
  it('shows the viewer their own hand but only opponents counts', () => {
    const view = projectView(baseState(), 0);
    expect(view.self.hand).toEqual([0, 1, 2]);
    expect(view.opponents).toHaveLength(1);
    expect(view.opponents[0]!.handCount).toBe(4);
    expect(view.opponents[0]).not.toHaveProperty('hand');
  });

  it('exposes the draw pile only as a count', () => {
    const view = projectView(baseState(), 1);
    expect(view.drawPileCount).toBe(5);
    expect(view).not.toHaveProperty('drawPile');
  });

  it('keeps the board (public) but returns copies, not references', () => {
    const state = baseState();
    const view = projectView(state, 0);
    expect(view.board.field).toEqual({ 5: [20], 7: [28, 29] });
    view.board.field[7]!.push(999);
    expect(state.board.field[7]).toEqual([28, 29]); // engine state untouched
  });

  it('reveals a pending decision in full to its owner, sanitised to others', () => {
    const state = baseState();
    state.phase = 'AWAITING_DECISION';
    state.pending = { kind: 'GO_OR_STOP', seat: 1, currentScore: 7 };

    const owner = projectView(state, 1);
    expect(owner.pending).toEqual({ kind: 'GO_OR_STOP', seat: 1, currentScore: 7 });

    const other = projectView(state, 0);
    expect(other.pending).toEqual({ kind: 'GO_OR_STOP', seat: 1, ownedByViewer: false });
    expect(other.pending).not.toHaveProperty('currentScore');
  });
});
