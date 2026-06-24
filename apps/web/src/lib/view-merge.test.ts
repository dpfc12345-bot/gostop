import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@gostop/engine';
import { mergePlayerView } from './view-merge.js';

function minimalView(field: PlayerView['board']['field']): PlayerView {
  return {
    gameId: 'g1',
    rulePreset: 'PMANG_NEWMATGO',
    phase: 'PLAYING',
    turn: 0,
    turnCount: 1,
    dealer: 0,
    stakeMultiplier: 1,
    drawPileCount: 40,
    self: {
      seat: 0,
      playerId: 'p0',
      hand: [1],
      captured: { brights: [], animals: [], ribbons: [], junk: [] },
      goCount: 0,
      hasShaken: false,
    },
    opponents: [
      {
        seat: 1,
        playerId: 'p1',
        handCount: 9,
        captured: { brights: [], animals: [], ribbons: [], junk: [] },
        goCount: 0,
        hasShaken: false,
      },
    ],
    board: { field },
  };
}

describe('mergePlayerView', () => {
  it('replaces board.field entirely so captured months disappear', () => {
    const base = minimalView({ 1: [0, 1], 3: [8, 9] });
    const patch = minimalView({ 3: [9] });
    // month 1 cleared on server after capture; only month 3 remains
    patch.board = { field: { 3: [9] } };

    const merged = mergePlayerView(base, patch);
    expect(merged.board.field).toEqual({ 3: [9] });
    expect(merged.board.field[1]).toBeUndefined();
  });

  it('clears pending when server full patch omits it (after DECLARE_GO)', () => {
    const base = minimalView({});
    base.pending = { kind: 'GO_OR_STOP', seat: 0, currentScore: 8 };
    base.self.goCount = 1;

    const patch = minimalView({});
    patch.self.goCount = 2;
    // no pending on patch — server cleared GO_OR_STOP

    const merged = mergePlayerView(base, patch);
    expect(merged.pending).toBeUndefined();
    expect(merged.self.goCount).toBe(2);
  });
});
