import type { GameEngine } from '@gostop/engine';
import type { EventStore } from '../persistence/event-store.interface.js';
import type { SnapshotStore } from '../persistence/snapshot-store.interface.js';
import type { LockService } from '../redis/lock.service.js';
import type { ActionDedupService } from '../redis/action-dedup.service.js';
import type { GameBroadcaster } from '../broadcast/broadcaster.interface.js';

export type RoomStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';

export interface RoomMember {
  userId: string;
  socketId: string;
  nickname: string;
  seat: number | null;
  isSpectator: boolean;
  ready: boolean;
  connected: boolean;
  isAi?: boolean;
}

export interface RoomActorDeps {
  eventStore: EventStore;
  snapshotStore: SnapshotStore;
  lock: LockService;
  actionDedup: ActionDedupService;
  broadcaster: GameBroadcaster;
  engine: GameEngine;
  /** Override for tests (default SNAPSHOT_INTERVAL). */
  snapshotInterval?: number;
  /** Deterministic seed for createGame (E2E / integration tests). */
  seedFactory?: (roomId: string) => string;
}

export interface DiffBatch {
  fromSeq: number;
  toSeq: number;
  /** socketId → per-recipient diff */
  bySocket: Record<string, import('@gostop/shared').StateDiffMsg>;
}
