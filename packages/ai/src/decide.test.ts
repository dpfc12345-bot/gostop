import { describe, expect, it } from 'vitest';
import type { GameAction, PlayerView } from '@gostop/engine';
import { decide } from './decide.js';

function baseView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    gameId: 'g1',
    rulePreset: 'PMANG_NEWMATGO',
    phase: 'PLAYING',
    turn: 1,
    turnCount: 1,
    dealer: 0,
    stakeMultiplier: 1,
    self: {
      seat: 1,
      playerId: 'ai',
      hand: [0, 4, 8],
      captured: { brights: [], animals: [], ribbons: [], junk: [] },
      goCount: 0,
      hasShaken: false,
    },
    opponents: [],
    board: { field: { 1: [1] } },
    drawPileCount: 40,
    ...overrides,
  };
}

describe('decide', () => {
  it('prefers STOP when score meets minimum', () => {
    const view = baseView({
      pending: { kind: 'GO_OR_STOP', seat: 1, currentScore: 8, minWinScore: 7 },
    });
    const legal: GameAction[] = [
      { type: 'DECLARE_GO', seat: 1 },
      { type: 'DECLARE_STOP', seat: 1 },
    ];
    expect(decide(view, legal).type).toBe('DECLARE_STOP');
  });

  it('plays a card matching the field month when possible', () => {
    const view = baseView({ board: { field: { 1: [1, 2] } } });
    const legal: GameAction[] = [
      { type: 'PLAY_CARD', seat: 1, cardId: 0 },
      { type: 'PLAY_CARD', seat: 1, cardId: 8 },
    ];
    expect(decide(view, legal).type).toBe('PLAY_CARD');
    expect((decide(view, legal) as { cardId: number }).cardId).toBe(0);
  });
});
