/**
 * The engine's core contracts.
 *
 *   reduce(state, action) -> { state, events }   // validate + advance the game
 *   applyEvent(state, event) -> state            // rebuild state from the log
 *
 * `reduce` is what the game server calls on each player intent. `applyEvent` is
 * its mirror: folding the recorded events over an initial state reproduces the
 * exact same game (admin replay / CS / anti-cheat). Both are PURE. The concrete
 * implementations arrive in step 5; here we fix the types and provide the pure
 * replay fold (which takes `applyEvent` by injection, so it is usable now).
 */
import type { GameEvent } from '../events/events.js';
import type { GameAction } from './actions.js';
import type { GameState } from './game-state.js';

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export type Reduce = (state: GameState, action: GameAction) => ReduceResult;

export type ApplyEvent = (state: GameState, event: GameEvent) => GameState;

/**
 * Rebuild a game by folding its event log over an initial state. Pure and
 * deterministic given a pure `applyEvent`. This is the backbone of replay:
 * `replayEvents(initialFromSeed, log, applyEvent)` must equal the live state.
 */
export function replayEvents(
  initial: GameState,
  events: readonly GameEvent[],
  applyEvent: ApplyEvent,
): GameState {
  return events.reduce<GameState>((state, event) => applyEvent(state, event), initial);
}
