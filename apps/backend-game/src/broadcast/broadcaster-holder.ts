import type { GameBroadcaster } from '../broadcast/broadcaster.interface.js';
import type {
  ChatMessageMsg,
  DecisionRequestMsg,
  GameResultMsg,
  GameSyncMsg,
  RoomMemberEvent,
  RoomStateMsg,
  StateDiffMsg,
} from '@gostop/shared';

/** Late-bound broadcaster — wired once the Socket.IO server is ready. */
export class BroadcasterHolder implements GameBroadcaster {
  private impl: GameBroadcaster | null = null;

  bind(impl: GameBroadcaster): void {
    this.impl = impl;
  }

  private get b(): GameBroadcaster {
    if (!this.impl) throw new Error('broadcaster not bound');
    return this.impl;
  }

  emitToSocket(socketId: string, event: 'game:sync', msg: GameSyncMsg): void;
  emitToSocket(socketId: string, event: 'game:diff', msg: StateDiffMsg): void;
  emitToSocket(socketId: string, event: 'game:decision', msg: DecisionRequestMsg): void;
  emitToSocket(socketId: string, event: 'game:ended', msg: GameResultMsg): void;
  emitToSocket(socketId: string, event: string, msg: unknown): void {
    switch (event) {
      case 'game:sync':
        this.b.emitToSocket(socketId, 'game:sync', msg as GameSyncMsg);
        break;
      case 'game:diff':
        this.b.emitToSocket(socketId, 'game:diff', msg as StateDiffMsg);
        break;
      case 'game:decision':
        this.b.emitToSocket(socketId, 'game:decision', msg as DecisionRequestMsg);
        break;
      case 'game:ended':
        this.b.emitToSocket(socketId, 'game:ended', msg as GameResultMsg);
        break;
    }
  }

  emitToRoom(roomId: string, event: 'room:state', msg: RoomStateMsg): void;
  emitToRoom(roomId: string, event: 'room:member', msg: RoomMemberEvent): void;
  emitToRoom(roomId: string, event: 'chat:message', msg: ChatMessageMsg): void;
  emitToRoom(roomId: string, event: string, msg: unknown): void {
    switch (event) {
      case 'room:state':
        this.b.emitToRoom(roomId, 'room:state', msg as RoomStateMsg);
        break;
      case 'room:member':
        this.b.emitToRoom(roomId, 'room:member', msg as RoomMemberEvent);
        break;
      case 'chat:message':
        this.b.emitToRoom(roomId, 'chat:message', msg as ChatMessageMsg);
        break;
    }
  }
}
