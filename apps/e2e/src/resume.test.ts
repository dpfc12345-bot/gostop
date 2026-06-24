import { randomUUID } from 'node:crypto';
import { hashState } from '@gostop/engine';
import { describe, expect, it } from 'vitest';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import {
  createSeededHarness,
  pickAction,
  startSeededTwoPlayerGame,
  verifyResumeFlow,
} from '@gostop/backend-game/testing';

describe('E2E — Resume verification', () => {
  it('session:resume SYNC/DIFF paths stay consistent across catalog seeds', async () => {
    const { playableSeeds } = getE2ESeedCatalog();

    for (const seed of playableSeeds.slice(0, 5)) {
      const harness = createSeededHarness(seed);
      const session = await startSeededTwoPlayerGame(harness, seed);
      const { room, gameId, p0, p1 } = session;

      await room.join({
        userId: 'spec-resume',
        socketId: `sock-spec-${seed}`,
        nickname: 'Spec',
        asSpectator: true,
      });

      for (let i = 0; i < 12 && room.state?.phase !== 'FINISHED'; i++) {
        const turn = room.state!.turn;
        await room.handleAction(
          { gameId, actionId: randomUUID(), action: pickAction(room.state!) },
          turn === 0 ? p0 : p1,
        );
      }

      verifyResumeFlow(room, gameId, p0, 'spec-resume');

      if (room.state?.phase === 'FINISHED') {
        const ended = room.resume({ gameId, lastSeq: room.eventSeq }, p0);
        expect(ended.status).toBe('ENDED');
      } else {
        const sync = room.resume({ gameId, lastSeq: room.eventSeq }, p0);
        if (sync.status === 'SYNC') {
          expect(sync.sync.stateHash).toBe(hashState(room.state!));
        }
      }
    }
  });
});
