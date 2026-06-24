/**
 * PlayerView — the projection of GameState that a single seat is allowed to see.
 *
 * This is the ONLY game shape sent to clients. The hidden-information boundary:
 *   - own hand              → fully visible
 *   - opponents' hands      → COUNT ONLY (handCount)
 *   - draw pile contents    → COUNT ONLY (drawPileCount)
 *   - everything else       → public (captured piles, board, scores, turn, go)
 *
 * Because captured piles and the board are public in Go-Stop, they are included
 * in full. A pending decision belonging to another seat is reduced to its kind.
 */
import type { RulePreset } from '../rules/rule-config.js';
import type {
  BoardState,
  CapturedPile,
  GamePhase,
  PendingDecision,
  PendingKind,
  Seat,
} from './game-state.js';
import type { CardId } from '../domain/card/card.js';

export interface SelfView {
  seat: Seat;
  playerId: string;
  /** Visible to self only. */
  hand: CardId[];
  captured: CapturedPile;
  goCount: number;
  hasShaken: boolean;
}

export interface OpponentView {
  seat: Seat;
  playerId: string;
  isAi: boolean;
  /** Public. */
  captured: CapturedPile;
  /** Hidden contents → count only. */
  handCount: number;
  goCount: number;
  hasShaken: boolean;
  connected: boolean;
}

/**
 * Pending decision as seen by a viewer. If the viewer owns the decision they
 * get the full detail; otherwise only the kind + owning seat (no hidden data).
 */
export type PendingDecisionView =
  | PendingDecision
  | { kind: PendingKind; seat: Seat; ownedByViewer: false };

export interface PlayerView {
  gameId: string;
  rulePreset: RulePreset;
  phase: GamePhase;
  turn: Seat;
  turnCount: number;
  dealer: Seat;
  stakeMultiplier: number;
  self: SelfView;
  opponents: OpponentView[];
  board: BoardState;
  /** Hidden contents → count only. */
  drawPileCount: number;
  pending?: PendingDecisionView;
  winner?: Seat | null;
  finalScore?: number;
}
