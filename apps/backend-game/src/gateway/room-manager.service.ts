import { Injectable } from '@nestjs/common';
import { gameEngine } from '@gostop/engine';
import { BroadcasterHolder } from '../broadcast/broadcaster-holder.js';
import { InMemoryEventStore } from '../persistence/in-memory-event-store.js';
import { InMemorySnapshotStore } from '../persistence/in-memory-snapshot-store.js';
import { InMemoryActionDedupService } from '../redis/action-dedup.service.js';
import { InMemoryLockService } from '../redis/in-memory-lock.service.js';
import type { RoomActorDeps } from '../room/room.types.js';
import { RoomManager } from '../room/room-manager.js';

@Injectable()
export class RoomManagerService {
  readonly broadcasterHolder = new BroadcasterHolder();
  readonly manager: RoomManager;

  constructor() {
    const deps: RoomActorDeps = {
      eventStore: new InMemoryEventStore(),
      snapshotStore: new InMemorySnapshotStore(),
      lock: new InMemoryLockService(),
      actionDedup: new InMemoryActionDedupService(),
      broadcaster: this.broadcasterHolder,
      engine: gameEngine,
    };
    this.manager = new RoomManager(deps);
  }
}
