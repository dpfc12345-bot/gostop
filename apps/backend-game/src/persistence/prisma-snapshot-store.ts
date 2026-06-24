import { PrismaClient } from '@gostop/db';
import type { GameState } from '@gostop/engine';
import type { SnapshotStore, StoredSnapshot } from './snapshot-store.interface.js';

export class PrismaSnapshotStore implements SnapshotStore {
  constructor(private readonly prisma: PrismaClient) {}

  async save(snapshot: StoredSnapshot & { gameId: string }): Promise<void> {
    await this.prisma.gameSnapshot.upsert({
      where: { gameId_seq: { gameId: snapshot.gameId, seq: snapshot.seq } },
      create: {
        gameId: snapshot.gameId,
        seq: snapshot.seq,
        state: snapshot.state as object,
        phase: snapshot.phase,
        version: 1,
      },
      update: {
        state: snapshot.state as object,
        phase: snapshot.phase,
      },
    });
  }

  async loadLatest(gameId: string): Promise<StoredSnapshot | null> {
    const row = await this.prisma.gameSnapshot.findFirst({
      where: { gameId },
      orderBy: { seq: 'desc' },
    });
    if (!row) return null;
    return {
      seq: row.seq,
      state: row.state as unknown as GameState,
      stateHash: '', // recomputed on recovery
      phase: row.phase,
    };
  }
}
