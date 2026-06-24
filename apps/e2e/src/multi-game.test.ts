import { describe, expect, it } from 'vitest';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import {
  createSeededHarness,
  playToCompletion,
  startSeededTwoPlayerGame,
  verifyReplayFromEventStore,
  verifyResumeFlow,
} from '@gostop/backend-game/testing';

describe('E2E — Multi-game (≥10 playable seeds)', () => {
  const catalog = getE2ESeedCatalog();

  it(`plays ${catalog.playableSeeds.length} full 2-player games to FINISHED`, async () => {
    expect(catalog.playableSeeds.length).toBeGreaterThanOrEqual(10);

    const results: { seed: string; steps: number }[] = [];

    for (const seed of catalog.playableSeeds) {
      const harness = createSeededHarness(seed);
      const session = await startSeededTwoPlayerGame(harness, seed);

      await roomJoinSpectator(session, seed);
      verifyResumeFlow(session.room, session.gameId, session.p0, `spec-${seed}`);
      const { steps, finalHash } = await playToCompletion(session);

      await verifyReplayFromEventStore(
        session.gameId,
        harness.eventStore,
        harness.snapshotStore,
        session.room.state!,
      );

      expect(session.room.state?.phase).toBe('FINISHED');
      expect(finalHash).toHaveLength(64);
      results.push({ seed, steps });
    }

    console.info(
      '[E2E multi-game]',
      results.map((r) => `${r.seed}:${r.steps}steps`).join(', '),
    );
  });

  it('covers special-rule seed tags from catalog', () => {
    const required = ['chongtong', 'shake-offer', 'go-or-stop'] as const;
    for (const tag of required) {
      expect(catalog.byTag[tag], `missing catalog seed for ${tag}`).toBeDefined();
    }
  });
});

async function roomJoinSpectator(
  session: Awaited<ReturnType<typeof startSeededTwoPlayerGame>>,
  seed: string,
): Promise<void> {
  await session.room.join({
    userId: `spec-${seed}`,
    socketId: `sock-spec-${seed}`,
    nickname: 'Spec',
    asSpectator: true,
  });
}
