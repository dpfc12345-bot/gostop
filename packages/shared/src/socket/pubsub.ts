/**
 * Redis Pub/Sub contract for horizontal scaling of backend-game.
 *
 * Any game-server instance can hold sockets for the same room/game. When an
 * instance applies an action it publishes the resulting messages on a channel;
 * every instance subscribed to that channel delivers them to its LOCAL sockets
 * that match the `audience`. Because StateDiff patches are per-seat (hidden
 * info), the publisher addresses each envelope to a specific audience and the
 * receiver fans it out only to the matching local sockets.
 *
 * This is the application-level message bus, distinct from the Socket.IO Redis
 * ADAPTER (which broadcasts room emits): here we carry typed domain payloads and
 * per-seat redaction, which the adapter alone cannot express.
 */
import type {
  ChatMessageMsg,
  DecisionRequestMsg,
  FriendPresenceMsg,
  GameResultMsg,
  GameSyncMsg,
  RoomMemberEvent,
  RoomStateMsg,
  StateDiffMsg,
} from './messages.js';

/** Channel name builders (one logical topic per room/game/lobby). */
export const PUBSUB_CHANNELS = {
  game: (gameId: string) => `gostop:game:${gameId}`,
  room: (roomId: string) => `gostop:room:${roomId}`,
  lobby: 'gostop:lobby',
  presence: (userId: string) => `gostop:presence:${userId}`,
} as const;

/** Who, within a channel, should receive a message. */
export type PubSubAudience =
  | { scope: 'ROOM' } // everyone in the room (players + spectators)
  | { scope: 'PLAYERS' } // all seated players
  | { scope: 'SPECTATORS' } // spectators only
  | { scope: 'SEAT'; seat: number } // a specific seat (per-seat redacted diff)
  | { scope: 'USER'; userId: string }; // a specific user (e.g. invite/presence)

export type PubSubKind =
  | 'STATE_DIFF'
  | 'GAME_SYNC'
  | 'GAME_DECISION'
  | 'GAME_ENDED'
  | 'ROOM_STATE'
  | 'ROOM_MEMBER'
  | 'CHAT'
  | 'PRESENCE';

/** Maps each kind to its payload type. */
export interface PubSubPayloadMap {
  STATE_DIFF: StateDiffMsg;
  GAME_SYNC: GameSyncMsg;
  GAME_DECISION: DecisionRequestMsg;
  GAME_ENDED: GameResultMsg;
  ROOM_STATE: RoomStateMsg;
  ROOM_MEMBER: RoomMemberEvent;
  CHAT: ChatMessageMsg;
  PRESENCE: FriendPresenceMsg;
}

/** Versioned cross-instance envelope. */
export interface PubSubEnvelope<K extends PubSubKind = PubSubKind> {
  v: 1;
  kind: K;
  /** Publishing instance id — receivers skip their own echo to avoid double-emit. */
  origin: string;
  /** Channel this was published on. */
  channel: string;
  /** Intended local recipients on each receiving instance. */
  audience: PubSubAudience;
  /** Publish time (epoch ms). */
  ts: number;
  payload: PubSubPayloadMap[K];
}

/** Discriminated union over every kind — what a subscriber parses. */
export type PubSubMessage = { [K in PubSubKind]: PubSubEnvelope<K> }[PubSubKind];

/** Serialise an envelope for publishing. */
export function encodePubSub(msg: PubSubMessage): string {
  return JSON.stringify(msg);
}

/** Parse a received payload. (Validate with a schema at the boundary in step 10.) */
export function decodePubSub(raw: string): PubSubMessage {
  return JSON.parse(raw) as PubSubMessage;
}
