import type { AppendEventEntry, EventStore, StoredEventEntry } from './event-store.interface.js';
import { envelope } from './event-store.interface.js';

/** In-process append-only log for tests and single-node dev. */
export class InMemoryEventStore implements EventStore {
  private readonly logs = new Map<string, StoredEventEntry[]>();

  async append(gameId: string, entries: AppendEventEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const log = this.logs.get(gameId) ?? [];
    for (const entry of entries) {
      if (log.some((e) => e.seq === entry.seq)) {
        throw new Error(`duplicate event seq ${entry.seq} for game ${gameId}`);
      }
      log.push({ ...envelope(entry), occurredAt: new Date() });
    }
    log.sort((a, b) => a.seq - b.seq);
    this.logs.set(gameId, log);
  }

  async loadFrom(gameId: string, fromSeq: number): Promise<StoredEventEntry[]> {
    const log = this.logs.get(gameId) ?? [];
    return log.filter((e) => e.seq >= fromSeq);
  }

  async getLatestSeq(gameId: string): Promise<number> {
    const log = this.logs.get(gameId) ?? [];
    if (log.length === 0) return -1;
    return log[log.length - 1]!.seq;
  }

  /** Test helper: raw log access. */
  dump(gameId: string): readonly StoredEventEntry[] {
    return [...(this.logs.get(gameId) ?? [])];
  }
}
