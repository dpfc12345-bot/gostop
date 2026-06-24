/**
 * GameEvent — an append-only FACT describing something that happened.
 *
 * Events are the Event Sourcing source of truth. They are deterministic: no
 * wall-clock time, no randomness (timestamps live in the storage envelope, not
 * the domain event). Replaying the ordered event log — or re-running the seed
 * through the reducer — reconstructs the game 100% for spectating, CS, and
 * anti-cheat investigation.
 *
 * `GameCreated` / `CardsDealt` intentionally include hidden cards: the log is
 * server-side only and powers the admin replay viewer.
 */
import type { CardId, Month } from '../domain/card/card.js';
import type { BakKind, RuleConfig } from '../rules/rule-config.js';
import type { CaptureCause, StealCause } from '../rules/rule-engine.js';
import type { ChoiceMap, Seat } from '../state/game-state.js';
import type { ScoreBreakdown } from '../scoring/score-breakdown.js';

export interface DealtHand {
  seat: Seat;
  cardIds: CardId[];
}

export interface Settlement {
  seat: Seat;
  /** Signed amount (positive = receives, negative = pays). */
  amount: number;
}

export type GameEvent =
  | {
      type: 'GameCreated';
      gameId: string;
      seed: string;
      rule: RuleConfig;
      scoreEngineVersion: number;
      players: { seat: Seat; playerId: string; isAi: boolean }[];
      dealer: Seat;
    }
  | {
      type: 'CardsDealt';
      hands: DealtHand[];
      field: CardId[];
      /** Full remaining deck order (server-side log only) → exact replay. */
      drawPile: CardId[];
      drawPileCount: number;
    }
  | { type: 'TurnStarted'; seat: Seat; turnCount: number }
  | { type: 'PlayerPlayedCard'; seat: Seat; cardId: CardId }
  | { type: 'CardPlacedOnField'; seat: Seat; cardId: CardId; source: 'HAND' | 'FLIP' }
  | { type: 'CardFlippedFromDeck'; seat: Seat; cardId: CardId }
  | {
      type: 'MatchChoiceRequired';
      seat: Seat;
      playedCardId: CardId;
      month: Month;
      candidates: CardId[];
      choices: ChoiceMap;
    }
  | { type: 'CardsCaptured'; seat: Seat; cardIds: CardId[]; cause: CaptureCause }
  | { type: 'GoStopRequired'; seat: Seat; score: number }
  | { type: 'PpeokOccurred'; seat: Seat; month: Month }
  | { type: 'JunkStolen'; fromSeat: Seat; toSeat: Seat; cardId: CardId; cause: StealCause }
  | { type: 'ShakeDeclared'; seat: Seat; month: Month }
  | { type: 'BombDeclared'; seat: Seat; month: Month; cardIds: CardId[] }
  | { type: 'KukjinChoiceRequired'; seat: Seat; cardId: CardId; after: 'END_TURN' | 'STAY' }
  | { type: 'KukjinDeclared'; seat: Seat; cardId: CardId; asDoubleJunk: boolean }
  /** 쇼당 — played and flipped card matched the same on-field month. Step-6 fact;
   *  the score effect is applied by the step-7 ScoreEngine. */
  | { type: 'ShowdownOccurred'; seat: Seat; month: Month }
  /** 멍따 — collected 열끗 ≥ threshold. Step-6 fact; effect applied in step 7. */
  | { type: 'MungttaAchieved'; seat: Seat; animalCount: number }
  | { type: 'ScoreEvaluated'; seat: Seat; score: number; breakdown: ScoreBreakdown }
  | { type: 'GoSelected'; seat: Seat; goCount: number; score: number }
  | { type: 'StopSelected'; seat: Seat; score: number }
  | { type: 'BakApplied'; seat: Seat; kinds: BakKind[] }
  | { type: 'NagariDeclared'; nextStakeMultiplier: number }
  /** 총통 — 4-of-a-month in the opening hand. Recorded SEPARATELY from GameEnded. */
  | { type: 'ChongtongDeclared'; seat: Seat; month: Month; score: number }
  | { type: 'GameEnded'; winner: Seat | null; score: number; settlement: Settlement[] };

export type GameEventType = GameEvent['type'];

/** Narrow a GameEvent by its `type`. */
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

/** Bump when the event shape changes, so stored logs can be migrated/validated. */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * Storage envelope for a persisted event. The pure domain `event` plus an
 * ordering `seq` and `version`; the persistence layer (step 4 ERD) additionally
 * stamps a non-deterministic `occurredAt` OUTSIDE this domain type.
 */
export interface StoredEvent {
  gameId: string;
  seq: number;
  version: number;
  event: GameEvent;
}
