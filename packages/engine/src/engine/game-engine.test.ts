import { describe, expect, it } from 'vitest';
import { createGame, getLegalActions, reduce } from './reduce.js';
import { applyEvent, initialStateForReplay } from './apply-event.js';
import { hashState, stableStringify } from './hash.js';
import { replayEvents } from '../state/reducer.js';
import type { GameAction } from '../state/actions.js';
import type { GameState } from '../state/game-state.js';
import type { CardId } from '../domain/card/card.js';
import type { GameEvent } from '../events/events.js';

const PLAYERS = [
  { seat: 0, playerId: 'A', isAi: false },
  { seat: 1, playerId: 'B', isAi: false },
];

/** Drive a full game deterministically by always taking the first legal action. */
function playFullGame(seed: string): {
  finalState: GameState;
  allEvents: GameEvent[];
  actions: GameAction[];
} {
  const genesis = createGame({ gameId: 'g1', seed, players: PLAYERS });
  let state = genesis.state;
  const allEvents: GameEvent[] = [...genesis.events];
  const actions: GameAction[] = [];

  let guard = 0;
  while (state.phase !== 'FINISHED') {
    const legal = getLegalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    const action = legal[0]!;
    actions.push(action);
    const result = reduce(state, action);
    state = result.state;
    allEvents.push(...result.events);
    if (++guard > 100_000) throw new Error('game did not terminate');
  }
  return { finalState: state, allEvents, actions };
}

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
  const field = Object.values(state.board.field).reduce(
    (sum, ids) => sum + (ids?.length ?? 0),
    0,
  );
  return captured + hands + field + state.drawPile.length;
}

describe('GameEngine — 2P 맞고 (PMANG_NEWMATGO)', () => {
  it('conserves all 48 cards throughout and ends with empty hands/deck', () => {
    const { finalState } = playFullGame('seed-conserve');
    expect(finalState.phase).toBe('FINISHED');
    expect(totalCardsHeld(finalState)).toBe(48);
    expect(finalState.players.every((p) => p.hand.length === 0)).toBe(true);
    expect(finalState.drawPile).toHaveLength(0);
  });

  it('REQ5: same seed + same action sequence ⇒ identical result', () => {
    const a = playFullGame('seed-determinism');
    const b = playFullGame('seed-determinism');
    expect(stableStringify(a.actions)).toBe(stableStringify(b.actions));
    expect(stableStringify(a.allEvents)).toBe(stableStringify(b.allEvents));
    expect(hashState(a.finalState)).toBe(hashState(b.finalState));
  });

  it('produces different outcomes for different seeds', () => {
    const a = playFullGame('seed-alpha');
    const b = playFullGame('seed-beta');
    expect(hashState(a.finalState)).not.toBe(hashState(b.finalState));
  });

  it('REQ7: reduce ≡ replayEvents (folding the event log reproduces the state)', () => {
    const { finalState, allEvents } = playFullGame('seed-replay');
    const replayed = replayEvents(initialStateForReplay(), allEvents, applyEvent);
    expect(hashState(replayed)).toBe(hashState(finalState));
    expect(stableStringify(replayed)).toBe(stableStringify(finalState));
  });

  it('REQ4 (Golden Replay): the recorded log reproduces a fixed state hash', () => {
    // Golden hashes pinned from a known-good run. A change here means engine
    // behaviour changed — intentional changes must update these on purpose.
    const golden: Record<string, string> = {
      'golden-1': 'f8568eebec677ec58b6de6317173920c53651d3ea7c2a9b93cff805ebf5e6860',
    };
    const { finalState, allEvents } = playFullGame('golden-1');
    const replayed = replayEvents(initialStateForReplay(), allEvents, applyEvent);
    const hash = hashState(finalState);
    expect(hashState(replayed)).toBe(hash);
    expect(hash).toBe(golden['golden-1']);
  });

  it('rejects illegal actions (server authority)', () => {
    const { state } = createGame({ gameId: 'g2', seed: 'seed-illegal', players: PLAYERS });
    const wrongSeat = state.turn === 0 ? 1 : 0;
    const someCard = state.players.find((p) => p.seat === wrongSeat)!.hand[0] as CardId;
    expect(() =>
      reduce(state, { type: 'PLAY_CARD', seat: wrongSeat, cardId: someCard }),
    ).toThrowError(/illegal action/i);
  });

  it('every reduce result equals folding its own events over the input state', () => {
    let state = createGame({ gameId: 'g3', seed: 'seed-fold', players: PLAYERS }).state;
    let steps = 0;
    while (state.phase !== 'FINISHED' && steps < 100_000) {
      const action = getLegalActions(state)[0]!;
      const { state: next, events } = reduce(state, action);
      const folded = events.reduce((s, e) => applyEvent(s, e), state);
      expect(hashState(folded)).toBe(hashState(next));
      state = next;
      steps++;
    }
    expect(state.phase).toBe('FINISHED');
  });
});
