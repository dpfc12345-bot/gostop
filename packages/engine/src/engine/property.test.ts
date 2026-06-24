/**
 * Property + fuzz tests for the engine (step 6 requirements):
 *
 *  1. Random Game Property Test — 10,000 randomly-played games must all conserve
 *     exactly 48 cards (no card is ever duplicated or lost), including across the
 *     special-rule paths (뻑/따닥/쪽/싹쓸이), and must terminate.
 *
 *  2. Replay Fuzz Test — for many random games, folding the recorded event log
 *     (replayEvents) must reproduce the exact state that reduce produced live
 *     (reduce ≡ replay), verified by both a stable serialisation and the SHA-256
 *     state hash.
 *
 * Action selection is itself seeded, so every iteration is fully reproducible.
 */
import { describe, expect, it } from 'vitest';
import { createGame, getLegalActions, reduce } from './reduce.js';
import { applyEvent, initialStateForReplay } from './apply-event.js';
import { hashState, stableStringify } from './hash.js';
import { replayEvents } from '../state/reducer.js';
import { createSeededRng } from '../rng/rng.js';
import type { GameState } from '../state/game-state.js';
import type { GameEvent } from '../events/events.js';

const PLAYERS = [
  { seat: 0, playerId: 'A', isAi: false },
  { seat: 1, playerId: 'B', isAi: false },
];

function totalCardsHeld(state: GameState): number {
  const captured = state.players.reduce(
    (sum, p) =>
      sum +
      p.captured.brights.length +
      p.captured.animals.length +
      p.captured.ribbons.length +
      p.captured.junk.length,
    0,
  );
  const hands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
  const field = Object.values(state.board.field).reduce((sum, ids) => sum + (ids?.length ?? 0), 0);
  return captured + hands + field + state.drawPile.length;
}

/** Play a full game choosing a random legal action with a seeded RNG. */
function randomGame(
  seed: string,
  checkEachStep: boolean,
): { finalState: GameState; allEvents: GameEvent[]; steps: number } {
  const rng = createSeededRng(`act:${seed}`);
  const genesis = createGame({ gameId: 'g', seed, players: PLAYERS });
  let state = genesis.state;
  const allEvents: GameEvent[] = [...genesis.events];

  if (checkEachStep && totalCardsHeld(state) !== 48) {
    throw new Error(`conservation broken at deal for ${seed}`);
  }

  let steps = 0;
  while (state.phase !== 'FINISHED') {
    const legal = getLegalActions(state);
    if (legal.length === 0) throw new Error(`no legal actions (not finished) for ${seed}`);
    const action = legal[rng.nextInt(legal.length)]!;
    const result = reduce(state, action);
    state = result.state;
    allEvents.push(...result.events);
    if (checkEachStep && totalCardsHeld(state) !== 48) {
      throw new Error(`conservation broken mid-game for ${seed} at step ${steps}`);
    }
    if (++steps > 100_000) throw new Error(`game did not terminate for ${seed}`);
  }
  return { finalState: state, allEvents, steps };
}

describe('Property — 10,000 random games conserve 48 cards', () => {
  it('every random game keeps exactly 48 cards and terminates', () => {
    const ITERATIONS = 10_000;
    // Per-step conservation checks for a representative slice (kept fast); the
    // remainder are verified at termination. Both cover the special-rule paths.
    const DEEP_CHECK = 400;

    for (let i = 0; i < ITERATIONS; i++) {
      const { finalState } = randomGame(`prop-${i}`, i < DEEP_CHECK);
      expect(totalCardsHeld(finalState)).toBe(48);
      expect(finalState.phase).toBe('FINISHED');
    }
  });
});

describe('Fuzz — reduce ≡ replayEvents over random games', () => {
  it('replaying the event log reproduces the exact live state', () => {
    const ITERATIONS = 500;
    for (let i = 0; i < ITERATIONS; i++) {
      const { finalState, allEvents } = randomGame(`fuzz-${i}`, false);
      const replayed = replayEvents(initialStateForReplay(), allEvents, applyEvent);
      expect(hashState(replayed)).toBe(hashState(finalState));
      expect(stableStringify(replayed)).toBe(stableStringify(finalState));
    }
  });
});
