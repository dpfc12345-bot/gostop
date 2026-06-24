import type { GameEvent } from '@gostop/engine';
import { EVENT_SCHEMA_VERSION } from '@gostop/engine';

export interface StoredEventEntry {
  seq: number;
  type: GameEvent['type'];
  version: number;
  event: GameEvent;
  occurredAt?: Date;
}

export interface AppendEventEntry {
  seq: number;
  event: GameEvent;
}

/**
 * Append-only event log. Implementations MUST reject duplicate seq and MUST
 * throw on persistence failure so callers never advance in-memory state.
 */
export interface EventStore {
  append(gameId: string, entries: AppendEventEntry[]): Promise<void>;
  loadFrom(gameId: string, fromSeq: number): Promise<StoredEventEntry[]>;
  getLatestSeq(gameId: string): Promise<number>;
}

export function envelope(entry: AppendEventEntry): Omit<StoredEventEntry, 'occurredAt'> {
  return {
    seq: entry.seq,
    type: entry.event.type,
    version: EVENT_SCHEMA_VERSION,
    event: entry.event,
  };
}
