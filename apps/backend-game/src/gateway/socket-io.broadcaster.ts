import type { Server } from 'socket.io';
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

/** Routes RoomActor broadcasts to Socket.IO rooms/sockets (network layer only). */
export class SocketIoBroadcaster implements GameBroadcaster {
  constructor(private readonly server: Server) {}

  emitToSocket(socketId: string, event: 'game:sync', msg: GameSyncMsg): void;
  emitToSocket(socketId: string, event: 'game:diff', msg: StateDiffMsg): void;
  emitToSocket(socketId: string, event: 'game:decision', msg: DecisionRequestMsg): void;
  emitToSocket(socketId: string, event: 'game:ended', msg: GameResultMsg): void;
  emitToSocket(
    socketId: string,
    event: 'game:sync' | 'game:diff' | 'game:decision' | 'game:ended',
    msg: unknown,
  ): void {
    this.server.to(socketId).emit(event, msg);
  }

  emitToRoom(roomId: string, event: 'room:state', msg: RoomStateMsg): void;
  emitToRoom(roomId: string, event: 'room:member', msg: RoomMemberEvent): void;
  emitToRoom(roomId: string, event: 'chat:message', msg: ChatMessageMsg): void;
  emitToRoom(
    roomId: string,
    event: 'room:state' | 'room:member' | 'chat:message',
    msg: unknown,
  ): void {
    this.server.to(roomId).emit(event, msg);
  }
}
