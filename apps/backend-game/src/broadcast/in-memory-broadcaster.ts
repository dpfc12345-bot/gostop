import type { GameBroadcaster } from './broadcaster.interface.js';
import type {
  ChatMessageMsg,
  DecisionRequestMsg,
  GameResultMsg,
  GameSyncMsg,
  RoomMemberEvent,
  RoomStateMsg,
  StateDiffMsg,
} from '@gostop/shared';

type Emitted = { socketId?: string; roomId?: string; event: string; payload: unknown };

/** Captures outbound messages for unit/integration tests. */
export class InMemoryBroadcaster implements GameBroadcaster {
  readonly messages: Emitted[] = [];

  emitToSocket(socketId: string, event: 'game:sync', msg: GameSyncMsg): void;
  emitToSocket(socketId: string, event: 'game:diff', msg: StateDiffMsg): void;
  emitToSocket(socketId: string, event: 'game:decision', msg: DecisionRequestMsg): void;
  emitToSocket(socketId: string, event: 'game:ended', msg: GameResultMsg): void;
  emitToSocket(
    socketId: string,
    event: 'game:sync' | 'game:diff' | 'game:decision' | 'game:ended',
    msg: unknown,
  ): void {
    this.messages.push({ socketId, event, payload: msg });
  }

  emitToRoom(roomId: string, event: 'room:state', msg: RoomStateMsg): void;
  emitToRoom(roomId: string, event: 'room:member', msg: RoomMemberEvent): void;
  emitToRoom(roomId: string, event: 'chat:message', msg: ChatMessageMsg): void;
  emitToRoom(
    roomId: string,
    event: 'room:state' | 'room:member' | 'chat:message',
    msg: unknown,
  ): void {
    this.messages.push({ roomId, event, payload: msg });
  }

  clear(): void {
    this.messages.length = 0;
  }
}
