/**
 * Socket message payloads (step 9).
 *
 * Design invariants, enforced by these types:
 *   - Action-Only client     : the ONLY gameplay input is `game:action` carrying
 *                              an engine GameAction. Clients never send state.
 *   - Server-Authoritative   : the server validates + reduces; clients receive
 *                              authoritative views/diffs and an ack.
 *   - Hidden information      : clients get PlayerView (own hand) / spectators get
 *                              SpectatorView (counts only). Hidden-bearing events
 *                              (GameCreated/CardsDealt) are never broadcast raw.
 *   - actionId dedup          : every action carries a uuid; the server applies it
 *                              at most once and replies DUPLICATE on retries.
 *   - StateDiff broadcast     : after each applied action the server sends a small
 *                              per-recipient PlayerView/SpectatorView patch + the
 *                              redacted events, not the whole state.
 *   - Reconnect/Resume        : `session:resume` with lastSeq → missed diffs or a
 *                              fresh full sync.
 */
import type {
  BoardState,
  CardId,
  GameAction,
  GameEvent,
  GamePhase,
  OpponentView,
  PendingDecisionView,
  PendingKind,
  PlayerView,
  RulePreset,
  ScoreBreakdown,
  Seat,
  Settlement,
} from '@gostop/engine';
import type { ApiError, MoneyAmount, PublicUser } from '../http/common.js';
import type { FriendPresence, GameMode } from '../http/enums.js';

// ─────────────────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────────────────

/** What a spectator sees: public-only, no `self`, all hands as counts. */
export interface SpectatorView {
  gameId: string;
  rulePreset: RulePreset;
  phase: GamePhase;
  turn: Seat;
  turnCount: number;
  dealer: Seat;
  stakeMultiplier: number;
  players: OpponentView[];
  board: BoardState;
  drawPileCount: number;
  pending?: { kind: PendingKind; seat: Seat };
  winner?: Seat | null;
  finalScore?: number | null;
}

/** A recipient sees exactly one of these depending on their role. */
export type StateView = PlayerView | SpectatorView;

// ─────────────────────────────────────────────────────────────────────────────
// Client-visible (redacted) events
// ─────────────────────────────────────────────────────────────────────────────

/** Events carrying hidden information; never broadcast verbatim. */
export type ServerOnlyEventType = 'GameCreated' | 'CardsDealt';

/** A deal as the client may see it (counts instead of concrete hidden cards). */
export interface RedactedCardsDealt {
  type: 'CardsDealt';
  field: CardId[];
  drawPileCount: number;
  hands: { seat: Seat; count: number }[];
}

/** A game-start announcement (public projection of GameCreated). */
export interface GameStartedEvent {
  type: 'GameStarted';
  gameId: string;
  rulePreset: RulePreset;
  scoreEngineVersion: number;
  dealer: Seat;
  players: { seat: Seat; playerId: string; isAi: boolean }[];
}

/** The event stream a client/spectator may receive (hidden cards redacted). */
export type ClientVisibleEvent =
  | Exclude<GameEvent, { type: ServerOnlyEventType }>
  | RedactedCardsDealt
  | GameStartedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Sync & diff
// ─────────────────────────────────────────────────────────────────────────────

/** Full authoritative view — sent on join/resume-too-far/desync recovery. */
export interface GameSyncMsg {
  gameId: string;
  /** Event seq this view reflects (the client's resume cursor). */
  seq: number;
  view: StateView;
  /** Optional SHA-256 integrity tag (full server state) for verification. */
  stateHash?: string;
}

/**
 * Incremental update after one applied action. The client merges `patch` into its
 * current view and replays `events` for animation/log. `fromSeq` enables gap
 * detection: if it ≠ the client's current seq, the client requests a resync.
 */
export interface StateDiffMsg {
  gameId: string;
  fromSeq: number;
  toSeq: number;
  events: ClientVisibleEvent[];
  /** Shallow-merge patch for the recipient's view (per-seat / spectator). */
  patch: Partial<PlayerView> | Partial<SpectatorView>;
  stateHash?: string;
}

/** Server prompts the owning seat that a decision is pending (modal trigger). */
export interface DecisionRequestMsg {
  gameId: string;
  seq: number;
  /** Present for AWAITING_DECISION; omitted for optional PLAYING declarations (shake/bomb). */
  decision?: PendingDecisionView;
  /** Exactly the actions the server will accept right now. */
  legalActions: GameAction[];
}

/** Final result, with the full ScoreBreakdown per player for the result screen. */
export interface GameResultMsg {
  gameId: string;
  winner: Seat | null;
  finalScore: number;
  settlement: Settlement[];
  breakdowns: ScoreBreakdown[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions & acks
// ─────────────────────────────────────────────────────────────────────────────

/** Client → server gameplay intent. The ONLY way a client affects a game. */
export interface ActionEnvelope {
  gameId: string;
  /** uuid; the server applies each actionId at most once (idempotent). */
  actionId: string;
  action: GameAction;
}

/** Server → client acknowledgement of an action. */
export type ActionAck =
  | { status: 'APPLIED'; actionId: string; seq: number }
  | { status: 'DUPLICATE'; actionId: string; seq: number }
  | { status: 'REJECTED'; actionId: string; error: ApiError; legalActions: GameAction[] };

// ─────────────────────────────────────────────────────────────────────────────
// Resume / reconnect
// ─────────────────────────────────────────────────────────────────────────────

export interface ResumeRequest {
  gameId: string;
  lastSeq: number;
  asSpectator?: boolean;
}

export type ResumeResult =
  | { status: 'SYNC'; sync: GameSyncMsg }
  | { status: 'DIFF'; diffs: StateDiffMsg[] }
  | { status: 'ENDED'; result: GameResultMsg }
  | { status: 'NOT_FOUND' };

// ─────────────────────────────────────────────────────────────────────────────
// Rooms / lobby / chat / presence
// ─────────────────────────────────────────────────────────────────────────────

export type RoomStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';

export interface RoomMember {
  user: PublicUser;
  seat: Seat | null;
  isAi: boolean;
  isSpectator: boolean;
  connected: boolean;
  ready: boolean;
}

export interface RoomStateMsg {
  roomId: string;
  gameId?: string | null;
  mode: GameMode;
  status: RoomStatus;
  hostUserId: string;
  stake: MoneyAmount;
  members: RoomMember[];
  spectatorCount: number;
}

export interface JoinRoomMsg {
  roomId: string;
  asSpectator?: boolean;
  /** Solo match vs AI bot. */
  solo?: boolean;
}

export type RoomJoinResult =
  | { status: 'OK'; room: RoomStateMsg; sync?: GameSyncMsg }
  | { status: 'FULL' }
  | { status: 'NOT_FOUND' }
  | { status: 'BANNED' };

export interface RoomMemberEvent {
  roomId: string;
  member: RoomMember;
  change: 'JOINED' | 'LEFT' | 'UPDATED';
}

export interface ChatSendMsg {
  roomId: string;
  content: string;
}

export interface ChatMessageMsg {
  roomId: string;
  from: PublicUser;
  content: string;
  at: number;
}

export interface FriendPresenceMsg {
  userId: string;
  presence: FriendPresence;
  currentRoomId?: string | null;
}

export interface OkAck {
  ok: boolean;
  error?: ApiError;
}

/** Out-of-band error (validation, rate limit, server fault). */
export interface SocketError extends ApiError {
  /** Correlates with the offending actionId/request, when applicable. */
  ref?: string;
}
