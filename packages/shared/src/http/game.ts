/**
 * Game record + Event-log query + Replay + State-hash verification + Admin
 * integrity verification.
 *
 * These contracts are the backbone of Event Sourcing: a game is reconstructable
 * 100% from (seed + ordered event log), the score of every hand is explained by
 * the ScoreBreakdown carried on `ScoreEvaluated` events, and any stored game can
 * be re-verified by replaying the log through the pure engine and comparing
 * SHA-256 state hashes.
 *
 * Ownership:
 *   - Read-only log/record queries  → backend-api (DB reads; no engine).
 *   - Replay reconstruction, hashing, verification → backend-game / a verifier
 *     service that may import @gostop/engine.
 */
import type {
  CardId,
  GameEvent,
  GameEventType,
  GameState,
  PlayerView,
  RuleConfig,
  Seat,
  StoredEvent,
} from '@gostop/engine';
import {
  defineEndpoint,
  type CursorQuery,
  type MoneyAmount,
  type Paginated,
} from './common.js';
import type { GameMode, GameStatus, ParticipantResult } from './enums.js';

// ─────────────────────────────────────────────────────────────────────────────
// Game record / summary
// ─────────────────────────────────────────────────────────────────────────────

export interface GameParticipantDto {
  seat: Seat;
  userId: string | null;
  nickname: string | null;
  isAi: boolean;
  aiLevel?: string | null;
  result?: ParticipantResult | null;
  score: number;
  goCount: number;
  payout: MoneyAmount;
}

export interface GameRecordDto {
  gameId: string;
  roomCode?: string | null;
  mode: GameMode;
  status: GameStatus;
  seed: string;
  scoreEngineVersion: number;
  playerCount: number;
  dealerSeat: Seat;
  stake: MoneyAmount;
  stakeMultiplier: number;
  winnerSeat?: Seat | null;
  winnerUserId?: string | null;
  finalScore?: number | null;
  /** Last appended event seq (the log cursor). */
  eventCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
  participants: GameParticipantDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// (4) Game Event query API — raw append-only log
// ─────────────────────────────────────────────────────────────────────────────

/** A persisted event with its storage timestamp (the JSON-wire form of StoredEvent). */
export interface StoredEventDto extends StoredEvent {
  /** Non-deterministic storage timestamp (outside the deterministic domain event). */
  occurredAt: string;
}

export interface GameEventQuery extends CursorQuery {
  /** Inclusive lower bound on seq. */
  fromSeq?: number;
  /** Inclusive upper bound on seq. */
  toSeq?: number;
  /** Filter to specific event types (comma-joined on the wire). */
  type?: GameEventType;
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) Replay API — reconstruct a game for the admin viewer & CS
// ─────────────────────────────────────────────────────────────────────────────

/** A single replay step: the event at `seq` and the authoritative state hash after it. */
export interface ReplayFrame {
  seq: number;
  event: GameEvent;
  /** SHA-256 of the full GameState AFTER applying events [0..seq]. */
  stateHash: string;
}

/** Replay summary metadata (header of the viewer). */
export interface ReplaySummaryDto extends GameRecordDto {
  rule: RuleConfig;
  /** Highlights for the timeline scrubber. */
  keyEvents: { seq: number; type: GameEventType; seat?: Seat }[];
}

/** Full reconstructed state at a seq (ADMIN only — contains hidden information). */
export interface ReplayStateDto {
  gameId: string;
  seq: number;
  stateHash: string;
  /** Full engine state, including hidden hands & draw pile. Admin-only. */
  state: GameState;
  /** Per-seat redacted views, for previewing exactly what each player saw. */
  views: PlayerView[];
}

export interface ReplayFramesQuery {
  fromSeq?: number;
  toSeq?: number;
}

export interface ReplaySeekBody {
  /** Reconstruct the state as of this seq (uses nearest snapshot + events). */
  seq: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// (3) State Hash Verification API — anti-cheat / live integrity
// ─────────────────────────────────────────────────────────────────────────────

export interface StateHashDto {
  gameId: string;
  seq: number;
  stateHash: string;
}

export interface VerifyHashBody {
  seq: number;
  /** The hash the caller computed/observed. */
  hash: string;
}

export interface VerifyHashResultDto {
  gameId: string;
  seq: number;
  expected: string;
  provided: string;
  match: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// (2) Admin Verification API — full integrity audit of a stored game
// ─────────────────────────────────────────────────────────────────────────────

export type VerificationIssueCode =
  | 'SNAPSHOT_HASH_MISMATCH'
  | 'REPLAY_DIVERGENCE'
  | 'FINAL_SCORE_MISMATCH'
  | 'SETTLEMENT_MISMATCH'
  | 'EVENT_SEQUENCE_GAP'
  | 'ILLEGAL_ACTION_DETECTED';

export interface VerificationIssue {
  code: VerificationIssueCode;
  seq?: number;
  message: string;
  details?: unknown;
}

/** Per-snapshot check: stored hash vs hash recomputed by replaying the log. */
export interface SnapshotCheck {
  seq: number;
  storedHash: string;
  recomputedHash: string;
  ok: boolean;
}

/**
 * Result of replaying the full event log through the pure engine and comparing
 * against stored snapshots, the recorded outcome, and the action legality.
 */
export interface GameVerificationReport {
  gameId: string;
  ok: boolean;
  scoreEngineVersion: number;
  eventCount: number;
  /** SHA-256 of the final reconstructed state. */
  recomputedFinalHash: string;
  /** Stored final hash (latest snapshot), if any. */
  storedFinalHash?: string | null;
  /** Snapshot integrity checks across the game. */
  snapshotChecks: SnapshotCheck[];
  /** `reduce(state, action)` and `replayEvents(log)` produced identical states. */
  reduceReplayEquivalent: boolean;
  /** Recomputed winner/score/settlement vs stored. */
  recomputedWinner: Seat | null;
  recomputedFinalScore: number | null;
  issues: VerificationIssue[];
  verifiedAt: string;
}

export interface VerifyGameBody {
  /** Re-run reduce≡replay equivalence (more expensive). Defaults true. */
  checkReduceEquivalence?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint descriptors
// ─────────────────────────────────────────────────────────────────────────────

export const GameRoutes = {
  /** (record) Game header + participants. */
  get: defineEndpoint<{ params: { gameId: string } }, GameRecordDto>('GET', '/games/:gameId'),

  /** (4) Paginated raw event log. */
  events: defineEndpoint<
    { params: { gameId: string }; query: GameEventQuery },
    Paginated<StoredEventDto>
  >('GET', '/games/:gameId/events'),

  /** (4) A single event by seq. */
  eventBySeq: defineEndpoint<{ params: { gameId: string; seq: string } }, StoredEventDto>(
    'GET',
    '/games/:gameId/events/:seq',
  ),

  /** (3) Authoritative state hash at a seq. */
  stateHash: defineEndpoint<
    { params: { gameId: string }; query: { seq?: number } },
    StateHashDto
  >('GET', '/games/:gameId/state-hash'),

  /** (3) Verify a caller-provided hash against the authoritative one. */
  verifyHash: defineEndpoint<
    { params: { gameId: string }; body: VerifyHashBody },
    VerifyHashResultDto
  >('POST', '/games/:gameId/verify-hash'),
} as const;

export const ReplayRoutes = {
  /** (1) Replay summary/header. */
  summary: defineEndpoint<{ params: { gameId: string } }, ReplaySummaryDto>(
    'GET',
    '/replays/:gameId',
  ),

  /** (1) Per-step frames (event + running state hash) for the timeline. */
  frames: defineEndpoint<
    { params: { gameId: string }; query: ReplayFramesQuery },
    ReplayFrame[]
  >('GET', '/replays/:gameId/frames'),

  /** (1) Reconstruct full state at a seq (ADMIN — hidden info). */
  seek: defineEndpoint<
    { params: { gameId: string }; body: ReplaySeekBody },
    ReplayStateDto
  >('POST', '/replays/:gameId/seek', 'ADMIN'),
} as const;

export const AdminGameRoutes = {
  /** (2) Full integrity verification by replaying the log through the engine. */
  verify: defineEndpoint<
    { params: { gameId: string }; body: VerifyGameBody },
    GameVerificationReport
  >('POST', '/admin/games/:gameId/verify', 'ADMIN'),
} as const;

/** Cards highlighted in a replay frame (for the viewer to flash on the table). */
export type ReplayHighlight = { seat: Seat; cards: CardId[] };

export type GameRouteset = typeof GameRoutes;
export type ReplayRouteset = typeof ReplayRoutes;
export type AdminGameRouteset = typeof AdminGameRoutes;

// Re-export the engine event/state types that consumers of these DTOs need, so
// backend-api (which must NOT import @gostop/engine) can still name them.
export type { GameEvent, StoredEvent, GameState, PlayerView } from '@gostop/engine';
