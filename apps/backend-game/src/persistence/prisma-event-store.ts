import { PrismaClient } from '@gostop/db';
import type { GameEvent } from '@gostop/engine';
import { EVENT_SCHEMA_VERSION } from '@gostop/engine';
import type { AppendEventEntry, EventStore, StoredEventEntry } from './event-store.interface.js';

/** PostgreSQL-backed append-only event store (Prisma). */
export class PrismaEventStore implements EventStore {
  constructor(private readonly prisma: PrismaClient) {}

  async append(gameId: string, entries: AppendEventEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.gameEvent.create({
          data: {
            gameId,
            seq: entry.seq,
            type: entry.event.type,
            version: EVENT_SCHEMA_VERSION,
            payload: entry.event as object,
          },
        }),
      ),
    );
  }

  async loadFrom(gameId: string, fromSeq: number): Promise<StoredEventEntry[]> {
    const rows = await this.prisma.gameEvent.findMany({
      where: { gameId, seq: { gte: fromSeq } },
      orderBy: { seq: 'asc' },
    });
    return rows.map((row) => ({
      seq: row.seq,
      type: row.type as GameEvent['type'],
      version: row.version,
      event: row.payload as GameEvent,
      occurredAt: row.createdAt,
    }));
  }

  async getLatestSeq(gameId: string): Promise<number> {
    const row = await this.prisma.gameEvent.findFirst({
      where: { gameId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    return row?.seq ?? -1;
  }
}
