/**
 * GameAction — a player's INTENT (a command), never a result.
 *
 * Clients send actions; the server validates them (turn, legality) and applies
 * them via the engine's reducer, which alone computes outcomes. Actions carry
 * only ids and the acting seat, so they are safe to serialise and log, and
 * impossible to use for cheating (no scores, no hidden cards).
 */
import type { CardId, Month } from '../domain/card/card.js';
import type { Seat } from './game-state.js';

export type GameAction =
  /** Play one card from hand onto the field. */
  | { type: 'PLAY_CARD'; seat: Seat; cardId: CardId }
  /** Resolve a CHOOSE_MATCH pending: pick which field card to capture. */
  | { type: 'CHOOSE_MATCH'; seat: Seat; targetCardId: CardId }
  /** Declare 흔들기 for a month held 3-of-a-kind, before playing. */
  | { type: 'DECLARE_SHAKE'; seat: Seat; month: Month }
  /** Play 폭탄: three same-month cards at once. */
  | { type: 'PLAY_BOMB'; seat: Seat; month: Month; cardIds: CardId[] }
  /** Resolve a CHOOSE_KUKJIN pending: use 국진 as a double junk or an animal. */
  | { type: 'CHOOSE_KUKJIN'; seat: Seat; asDoubleJunk: boolean }
  /** Reached the finish threshold and chooses to continue (고). */
  | { type: 'DECLARE_GO'; seat: Seat }
  /** Reached the finish threshold and chooses to stop and win (스톱). */
  | { type: 'DECLARE_STOP'; seat: Seat };

export type GameActionType = GameAction['type'];

/** Narrow a GameAction by its `type`. */
export type ActionOf<T extends GameActionType> = Extract<GameAction, { type: T }>;
