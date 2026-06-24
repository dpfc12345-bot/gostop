/**
 * GameState — the complete, server-authoritative truth for one game.
 *
 * This object CONTAINS HIDDEN INFORMATION (every hand, the draw pile order) and
 * must never be sent to a client as-is. Clients receive a `PlayerView`
 * (see player-view.ts) produced by `projectView`. GameState is treated as
 * immutable: the engine's reducer returns a new GameState rather than mutating.
 */
import type { CardId, Month } from '../domain/card/card.js';
import type { RuleConfig } from '../rules/rule-config.js';

/** 0-based seat index in turn order. */
export type Seat = number;

/** Choices made while resolving a turn: month → chosen field card id. */
export type ChoiceMap = Record<number, CardId>;

export type GamePhase =
  | 'CREATED' // constructed, not yet dealt
  | 'DEALING' // deal in progress (transient)
  | 'PLAYING' // normal turn play
  | 'AWAITING_DECISION' // blocked on a player choice (see PendingDecision)
  | 'FINISHED'; // game over

/**
 * Captured cards, grouped by category for fast scoring. Junk holds both normal
 * 피 and 쌍피 (the value is read from the card attributes / rule config).
 */
export interface CapturedPile {
  brights: CardId[]; // 광
  animals: CardId[]; // 열끗
  ribbons: CardId[]; // 띠
  junk: CardId[]; // 피 (+ 쌍피)
}

export interface PlayerState {
  seat: Seat;
  playerId: string;
  isAi: boolean;
  /** PRIVATE — hidden from everyone else. */
  hand: CardId[];
  /** PUBLIC — visible to all. */
  captured: CapturedPile;
  /** Times this player has declared 고. */
  goCount: number;
  /** Score at the player's last 고/스톱 decision; the gate only re-fires above it. */
  lastGoScore: number;
  /** 흔들기 declared this game. */
  hasShaken: boolean;
  shakenMonths: Month[];
  /** 폭탄 played count (affects extra turns / junk). */
  bombCount: number;
  /** 멍따 achieved (열끗 ≥ threshold). Recorded in step 6; scored in step 7. */
  mungtta: boolean;
  /** 쇼당 occurrences triggered by this player. Recorded in step 6; scored in step 7. */
  showdownCount: number;
  /** Connection liveness (for reconnect handling at the server layer). */
  connected: boolean;
}

/** Field piles keyed by month (바닥). PUBLIC. */
export type FieldPiles = Partial<Record<Month, CardId[]>>;

export interface BoardState {
  field: FieldPiles;
}

/**
 * A choice the engine is waiting on before it can continue. Encodes the type of
 * decision and which seat must make it. Candidate ids reference public field
 * cards, so a pending decision never leaks hidden information.
 */
export type PendingDecision =
  | { kind: 'GO_OR_STOP'; seat: Seat; currentScore: number }
  | {
      kind: 'CHOOSE_MATCH';
      seat: Seat;
      /** The hand card the player is resolving this turn. */
      playedCardId: CardId;
      /** The month whose 2 candidates must be chosen between right now. */
      month: Month;
      candidates: CardId[];
      /** Choices already made this turn (for re-entrant turn planning). */
      choices: ChoiceMap;
    }
  | { kind: 'CHOOSE_KUKJIN'; seat: Seat; cardId: CardId; after: 'END_TURN' | 'STAY' }
  | { kind: 'SHAKE_CONFIRM'; seat: Seat; month: Month }
  | { kind: 'SHOWDOWN'; seat: Seat; month: Month };

export type PendingKind = PendingDecision['kind'];

export interface GameState {
  gameId: string;
  /** Seed that produced the deal & draw-pile order — replay reproducible. */
  seed: string;
  /** Resolved rules snapshot, so the game replays under its original rules. */
  rule: RuleConfig;
  /**
   * The ScoreEngine version this game was played under. Scoring always uses the
   * versioned implementation recorded here, so a game stays reproducible even
   * after the engine ships newer scoring logic or the presets change.
   */
  scoreEngineVersion: number;
  phase: GamePhase;
  players: PlayerState[];
  /** 선 — the dealer / first player. */
  dealer: Seat;
  /** Seat whose turn it currently is. */
  turn: Seat;
  /** Monotonic turn counter (1-based once play starts). */
  turnCount: number;
  board: BoardState;
  /** PRIVATE — remaining deck, draw order fixed by the seeded shuffle. */
  drawPile: CardId[];
  /** Carried stake multiplier (e.g. from 나가리). */
  stakeMultiplier: number;
  /** Set while phase === 'AWAITING_DECISION'. */
  pending?: PendingDecision;
  /** Sequence number of the last applied event (Event Sourcing cursor). */
  eventSeq: number;
  /** Winner seat once FINISHED; null means 나가리 (draw, no winner). */
  winner?: Seat | null;
  /** Winner's final score once FINISHED. */
  finalScore?: number;
}
