import { describe, expect, it } from 'vitest';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import {
  createSeededHarness,
  startSeededTwoPlayerGame,
  verifySpectatorCannotAct,
} from '@gostop/backend-game/testing';

describe('E2E — Spectator verification', () => {
  it('spectator receives SpectatorView and cannot submit actions', async () => {
    const { playableSeeds } = getE2ESeedCatalog();

    for (const seed of playableSeeds.slice(0, 5)) {
      const harness = createSeededHarness(seed);
      const session = await startSeededTwoPlayerGame(harness, seed);
      const { room, gameId } = session;

      await room.join({
        userId: 'spec-user',
        socketId: `sock-spec-${seed}`,
        nickname: 'Spectator',
        asSpectator: true,
      });

      const sync = room.resume({ gameId, lastSeq: room.eventSeq }, 'spec-user');
      expect(sync.status).toBe('SYNC');
      if (sync.status === 'SYNC') {
        expect('players' in sync.sync.view).toBe(true);
        expect('self' in sync.sync.view).toBe(false);
      }

      await verifySpectatorCannotAct(room, gameId, 'spec-user');
    }
  });
});
