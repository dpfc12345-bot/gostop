/**
 * Contract consistency tests: the action schema accepts every engine action and
 * rejects malformed input, and the endpoint descriptors are well-formed.
 */
import { describe, expect, it } from 'vitest';
import type { GameAction } from '@gostop/engine';
import { actionEnvelopeSchema, gameActionSchema } from './schemas/index.js';
import { FriendRoutes, GameRoutes, RankingRoutes, ReplayRoutes, WalletRoutes } from './http/index.js';

const sampleActions: GameAction[] = [
  { type: 'PLAY_CARD', seat: 0, cardId: 12 },
  { type: 'CHOOSE_MATCH', seat: 1, targetCardId: 5 },
  { type: 'DECLARE_SHAKE', seat: 0, month: 3 },
  { type: 'PLAY_BOMB', seat: 0, month: 9, cardIds: [32, 33, 34] },
  { type: 'CHOOSE_KUKJIN', seat: 1, asDoubleJunk: true },
  { type: 'DECLARE_GO', seat: 0 },
  { type: 'DECLARE_STOP', seat: 1 },
];

describe('gameActionSchema ↔ engine GameAction', () => {
  it('accepts every engine action variant unchanged', () => {
    for (const action of sampleActions) {
      const parsed = gameActionSchema.parse(action);
      expect(parsed).toEqual(action);
    }
  });

  it('rejects out-of-range card ids and months', () => {
    expect(() => gameActionSchema.parse({ type: 'PLAY_CARD', seat: 0, cardId: 48 })).toThrow();
    expect(() => gameActionSchema.parse({ type: 'DECLARE_SHAKE', seat: 0, month: 13 })).toThrow();
    expect(() => gameActionSchema.parse({ type: 'NOPE', seat: 0 })).toThrow();
  });

  it('validates the socket action envelope (gameId + uuid actionId + action)', () => {
    const env = {
      gameId: 'game_123',
      actionId: '00000000-0000-4000-8000-000000000000',
      action: { type: 'DECLARE_GO', seat: 0 },
    };
    expect(actionEnvelopeSchema.parse(env)).toEqual(env);
    expect(() => actionEnvelopeSchema.parse({ ...env, actionId: 'not-a-uuid' })).toThrow();
  });
});

describe('REST endpoint descriptors', () => {
  it('declare method/path/auth', () => {
    expect(GameRoutes.events.method).toBe('GET');
    expect(GameRoutes.events.path).toBe('/games/:gameId/events');
    expect(ReplayRoutes.seek.auth).toBe('ADMIN');
    expect(RankingRoutes.list.auth).toBe('NONE');
    expect(WalletRoutes.transfer.method).toBe('POST');
    expect(FriendRoutes.createRequest.path).toBe('/friends/requests');
  });
});
