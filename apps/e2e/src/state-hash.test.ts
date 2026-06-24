import { hashState } from '@gostop/engine';
import { describe, expect, it } from 'vitest';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import type { GameSyncMsg, StateDiffMsg } from '@gostop/shared';
import {
  createSeededHarness,
  playToCompletion,
  startSeededTwoPlayerGame,
  verifyBroadcastStateHashes,
} from '@gostop/backend-game/testing';

describe('E2E — State Hash verification', () => {
  it('final broadcast sync/diff hashes match authoritative state for all playable seeds', async () => {
    const { playableSeeds } = getE2ESeedCatalog();

    for (const seed of playableSeeds) {
      const harness = createSeededHarness(seed);
      const session = await startSeededTwoPlayerGame(harness, seed);
      await playToCompletion(session);

      const liveHash = hashState(session.room.state!);
      verifyBroadcastStateHashes(harness.broadcaster, session.room.state!, [
        `sock-a-${seed}`,
        `sock-b-${seed}`,
      ]);

      const playerSyncs = harness.broadcaster.messages.filter(
        (m) => m.event === 'game:sync' && m.socketId === `sock-a-${seed}`,
      );
      const lastSync = playerSyncs[playerSyncs.length - 1]?.payload as GameSyncMsg | undefined;
      if (lastSync) expect(lastSync.stateHash).toBe(liveHash);

      const playerDiffs = harness.broadcaster.messages.filter(
        (m) => m.event === 'game:diff' && m.socketId === `sock-a-${seed}`,
      );
      const lastDiff = playerDiffs[playerDiffs.length - 1]?.payload as StateDiffMsg | undefined;
      if (lastDiff) expect(lastDiff.stateHash).toBe(liveHash);
    }
  });
});
