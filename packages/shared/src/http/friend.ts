/**
 * (6) Friend API.
 *
 * Backed by FriendRequest (pending invites) + Friendship (accepted, stored as
 * two directed rows). Presence (online / in-room) is hydrated from Redis by the
 * service layer so the lobby can show who is available to invite.
 */
import {
  defineEndpoint,
  type CursorQuery,
  type Paginated,
  type PublicUser,
} from './common.js';
import type { FriendPresence, FriendRequestStatus } from './enums.js';

export interface FriendDto {
  user: PublicUser;
  presence: FriendPresence;
  /** Room/game the friend is currently in (for "join"/"spectate"), if any. */
  currentRoomId?: string | null;
  friendsSince: string;
}

export interface FriendRequestDto {
  id: string;
  requester: PublicUser;
  addressee: PublicUser;
  status: FriendRequestStatus;
  message?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

/** Address a friend request by user id OR by exact username. */
export interface CreateFriendRequestBody {
  addresseeId?: string;
  username?: string;
  message?: string;
}

export interface FriendRequestsQuery extends CursorQuery {
  direction: 'INCOMING' | 'OUTGOING';
  status?: FriendRequestStatus;
}

export interface InviteToRoomBody {
  roomId: string;
}

export interface OkDto {
  ok: true;
}

export const FriendRoutes = {
  /** List accepted friends (with live presence). */
  list: defineEndpoint<{ query: CursorQuery }, Paginated<FriendDto>>('GET', '/friends'),

  /** List incoming/outgoing friend requests. */
  requests: defineEndpoint<
    { query: FriendRequestsQuery },
    Paginated<FriendRequestDto>
  >('GET', '/friends/requests'),

  /** Send a friend request. */
  createRequest: defineEndpoint<{ body: CreateFriendRequestBody }, FriendRequestDto>(
    'POST',
    '/friends/requests',
  ),

  /** Accept an incoming request → creates the friendship. */
  acceptRequest: defineEndpoint<{ params: { id: string } }, FriendDto>(
    'POST',
    '/friends/requests/:id/accept',
  ),

  /** Decline an incoming request. */
  declineRequest: defineEndpoint<{ params: { id: string } }, OkDto>(
    'POST',
    '/friends/requests/:id/decline',
  ),

  /** Cancel an outgoing request. */
  cancelRequest: defineEndpoint<{ params: { id: string } }, OkDto>(
    'DELETE',
    '/friends/requests/:id',
  ),

  /** Remove an existing friend (both directed rows). */
  remove: defineEndpoint<{ params: { friendId: string } }, OkDto>(
    'DELETE',
    '/friends/:friendId',
  ),

  /** Invite a friend into a room (emits a socket notification to them). */
  invite: defineEndpoint<
    { params: { friendId: string }; body: InviteToRoomBody },
    OkDto
  >('POST', '/friends/:friendId/invite'),
} as const;

export type FriendRouteset = typeof FriendRoutes;
