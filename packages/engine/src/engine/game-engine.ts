/**
 * GameEngine facade — bundles the pure functions with injected dependencies
 * (ScoreCalculator, RuleEngine). Web, mobile, the game server and the AI all use
 * this same object. `createGame` needs no deps; `reduce` uses the injected ones.
 */
import type { GameAction } from '../state/actions.js';
import type { GameState } from '../state/game-state.js';
import type { GameEvent } from '../events/events.js';
import type { ReduceResult } from '../state/reducer.js';
import { replayEvents } from '../state/reducer.js';
import { applyEvent, initialStateForReplay } from './apply-event.js';
import { defaultDeps, type EngineDeps } from './deps.js';
import { hashState } from './hash.js';
import { createGame, getLegalActions, reduce, type CreateGameParams } from './reduce.js';

export interface GameEngine {
  createGame(params: CreateGameParams): ReduceResult;
  reduce(state: GameState, action: GameAction): ReduceResult;
  applyEvent(state: GameState, event: GameEvent): GameState;
  getLegalActions(state: GameState): GameAction[];
  hashState(state: GameState): string;
  /** Rebuild a game from its full event log (genesis events first). */
  replay(events: readonly GameEvent[]): GameState;
}

export function createGameEngine(deps: Partial<EngineDeps> = {}): GameEngine {
  const merged: EngineDeps = { ...defaultDeps, ...deps };
  return {
    createGame,
    reduce: (state, action) => reduce(state, action, merged),
    applyEvent,
    getLegalActions,
    hashState,
    replay: (events) => replayEvents(initialStateForReplay(), events, applyEvent),
  };
}

/** Default engine using the step-5 stubs for scoring and special rules. */
export const gameEngine: GameEngine = createGameEngine();
