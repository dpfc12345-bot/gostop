import { gameEngine } from '@gostop/engine';
import { InMemoryBroadcaster } from '../broadcast/in-memory-broadcaster.js';
import { InMemoryEventStore } from '../persistence/in-memory-event-store.js';
import { InMemorySnapshotStore } from '../persistence/in-memory-snapshot-store.js';
import { InMemoryActionDedupService } from '../redis/action-dedup.service.js';
import { InMemoryLockService } from '../redis/in-memory-lock.service.js';
import type { RoomActorDeps } from './room.types.js';
import { RoomActor } from './room-actor.js';

export class RoomManager {
  private readonly rooms = new Map<string, RoomActor>();
  private readonly socketIndex = new Map<string, string>();

  constructor(private readonly deps: RoomActorDeps) {}

  getOrCreate(roomId: string): RoomActor {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomActor(roomId, this.deps);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  findBySocket(socketId: string): RoomActor | undefined {
    const roomId = this.socketIndex.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  findByGameId(gameId: string): RoomActor | undefined {
    for (const room of this.rooms.values()) {
      if (room.gameId === gameId) return room;
    }
    return undefined;
  }

  bindSocket(roomId: string, socketId: string): void {
    this.socketIndex.set(socketId, roomId);
  }

  unbindSocket(socketId: string): void {
    this.socketIndex.delete(socketId);
  }

  async recoverRoom(roomId: string, gameId: string): Promise<RoomActor> {
    const room = await RoomActor.recover(roomId, gameId, this.deps);
    this.rooms.set(roomId, room);
    return room;
  }
}

/** Factory for tests — in-memory persistence + lock + spy broadcaster. */
export function createTestRoomManager(
  snapshotInterval?: number,
  seedFactory?: (roomId: string) => string,
): {
  manager: RoomManager;
  broadcaster: InMemoryBroadcaster;
  eventStore: InMemoryEventStore;
  snapshotStore: InMemorySnapshotStore;
} {
  const eventStore = new InMemoryEventStore();
  const snapshotStore = new InMemorySnapshotStore();
  const broadcaster = new InMemoryBroadcaster();
  const deps: RoomActorDeps = {
    eventStore,
    snapshotStore,
    lock: new InMemoryLockService(),
    actionDedup: new InMemoryActionDedupService(),
    broadcaster,
    engine: gameEngine,
    ...(snapshotInterval !== undefined ? { snapshotInterval } : {}),
    ...(seedFactory !== undefined ? { seedFactory } : {}),
  };
  return { manager: new RoomManager(deps), broadcaster, eventStore, snapshotStore };
}
