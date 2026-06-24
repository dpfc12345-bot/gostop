import type {
  ActionAck,
  ChatMessageMsg,
  DecisionRequestMsg,
  GameResultMsg,
  GameSyncMsg,
  ResumeResult,
  RoomJoinResult,
  RoomMemberEvent,
  RoomStateMsg,
  StateDiffMsg,
} from '@gostop/shared';

/** Outbound messaging port — implemented by the Socket gateway or test spy. */
export interface GameBroadcaster {
  emitToSocket(socketId: string, event: 'game:sync', msg: GameSyncMsg): void;
  emitToSocket(socketId: string, event: 'game:diff', msg: StateDiffMsg): void;
  emitToSocket(socketId: string, event: 'game:decision', msg: DecisionRequestMsg): void;
  emitToSocket(socketId: string, event: 'game:ended', msg: GameResultMsg): void;
  emitToRoom(roomId: string, event: 'room:state', msg: RoomStateMsg): void;
  emitToRoom(roomId: string, event: 'room:member', msg: RoomMemberEvent): void;
  emitToRoom(roomId: string, event: 'chat:message', msg: ChatMessageMsg): void;
}

export type { ActionAck, ResumeResult, RoomJoinResult };
