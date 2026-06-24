/**
 * Typed Socket.IO event maps (client↔server) + the namespace/event-name
 * constants. These are the contract the backend-game gateway implements and the
 * web/mobile clients consume — fully type-checked on both ends.
 *
 * Transport-agnostic: no `socket.io` import. The apps parameterise
 * `Server`/`Socket` with these maps.
 */
import type {
  ActionAck,
  ActionEnvelope,
  ChatMessageMsg,
  ChatSendMsg,
  DecisionRequestMsg,
  FriendPresenceMsg,
  GameResultMsg,
  GameSyncMsg,
  JoinRoomMsg,
  OkAck,
  ResumeRequest,
  ResumeResult,
  RoomJoinResult,
  RoomMemberEvent,
  RoomStateMsg,
  SocketError,
  StateDiffMsg,
} from './messages.js';

/** Socket.IO namespaces. */
export const SOCKET_NAMESPACES = {
  /** Gameplay, rooms, in-room chat. */
  game: '/game',
  /** Matchmaking, presence, friend invites. */
  lobby: '/lobby',
} as const;

/** Canonical event names (avoids stringly-typed drift across apps). */
export const SOCKET_EVENTS = {
  // client → server
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  roomReady: 'room:ready',
  gameAction: 'game:action',
  sessionResume: 'session:resume',
  chatSend: 'chat:send',
  heartbeat: 'heartbeat',
  // server → client
  roomState: 'room:state',
  roomMember: 'room:member',
  gameSync: 'game:sync',
  gameDiff: 'game:diff',
  gameDecision: 'game:decision',
  gameEnded: 'game:ended',
  chatMessage: 'chat:message',
  presenceFriend: 'presence:friend',
  errorEvent: 'error',
} as const;

/**
 * Client → server. Every gameplay mutation is `game:action` (Action-Only); all
 * other inbound events are room/session lifecycle. Acks return authoritative
 * results so the client never assumes success.
 */
export interface ClientToServerEvents {
  'room:join': (payload: JoinRoomMsg, ack: (res: RoomJoinResult) => void) => void;
  'room:leave': (payload: { roomId: string }, ack: (res: OkAck) => void) => void;
  'room:ready': (payload: { roomId: string; ready: boolean }, ack: (res: OkAck) => void) => void;
  /** The single gameplay input. */
  'game:action': (payload: ActionEnvelope, ack: (res: ActionAck) => void) => void;
  /** Reconnect/resume from a known seq. */
  'session:resume': (payload: ResumeRequest, ack: (res: ResumeResult) => void) => void;
  'chat:send': (payload: ChatSendMsg) => void;
  'heartbeat': (ack: (res: { serverTime: number }) => void) => void;
}

/** Server → client. Authoritative state, diffs, decisions, results, presence. */
export interface ServerToClientEvents {
  'room:state': (msg: RoomStateMsg) => void;
  'room:member': (msg: RoomMemberEvent) => void;
  'game:sync': (msg: GameSyncMsg) => void;
  'game:diff': (msg: StateDiffMsg) => void;
  'game:decision': (msg: DecisionRequestMsg) => void;
  'game:ended': (msg: GameResultMsg) => void;
  'chat:message': (msg: ChatMessageMsg) => void;
  'presence:friend': (msg: FriendPresenceMsg) => void;
  'error': (msg: SocketError) => void;
}

/**
 * Per-connection server-side state attached to each socket (after auth).
 * `seat` is null for spectators; the gateway uses these for routing/authorization.
 */
export interface SocketData {
  userId: string;
  sessionId: string;
  /** Rooms this socket has joined. */
  rooms: string[];
  /** Active game + seat, when seated at a table. */
  gameId?: string;
  seat?: number | null;
  isSpectator: boolean;
}
