import { describe, expect, it } from 'vitest';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import {
  createSeededHarness,
  playToCompletion,
  startSeededTwoPlayerGame,
  verifyReplayFromEventStore,
} from '@gostop/backend-game/testing';

describe('E2E — Replay verification', () => {
  it('EventStore replay ≡ live state for each catalog playable seed', async () => {
    const { playableSeeds } = getE2ESeedCatalog();

    for (const seed of playableSeeds) {
      const harness = createSeededHarness(seed);
      const session = await startSeededTwoPlayerGame(harness, seed);
      await playToCompletion(session);

      await expect(
        verifyReplayFromEventStore(
          session.gameId,
          harness.eventStore,
          harness.snapshotStore,
          session.room.state!,
        ),
      ).resolves.toBeUndefined();
    }
  });
});
