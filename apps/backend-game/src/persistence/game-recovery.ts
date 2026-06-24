import {
  applyEvent,
  hashState,
  initialStateForReplay,
  replayEvents,
  type GameState,
} from '@gostop/engine';
import type { EventStore } from './event-store.interface.js';
import type { SnapshotStore } from './snapshot-store.interface.js';

export interface RecoveredGame {
  state: GameState;
  eventSeq: number;
  stateHash: string;
}

/**
 * Rebuild authoritative state from Snapshot + EventStore (server restart path).
 * Verifies the snapshot hash when present, then replays tail events.
 */
export async function recoverGameState(
  gameId: string,
  eventStore: EventStore,
  snapshotStore: SnapshotStore,
): Promise<RecoveredGame> {
  const snapshot = await snapshotStore.loadLatest(gameId);
  let state: GameState;
  let fromSeq: number;

  if (snapshot) {
    state = structuredClone(snapshot.state);
    fromSeq = snapshot.seq + 1;
    const snapHash = hashState(state);
    if (snapshot.stateHash && snapshot.stateHash !== snapHash) {
      throw new Error(
        `snapshot hash mismatch at seq ${snapshot.seq}: stored=${snapshot.stateHash} recomputed=${snapHash}`,
      );
    }
  } else {
    state = initialStateForReplay();
    fromSeq = 0;
  }

  const tail = await eventStore.loadFrom(gameId, fromSeq);
  if (tail.length > 0) {
    state = replayEvents(
      state,
      tail.map((e) => e.event),
      applyEvent,
    );
  }

  state = { ...state, gameId };
  const latestSeq = await eventStore.getLatestSeq(gameId);
  const stateHash = hashState(state);
  return { state, eventSeq: latestSeq, stateHash };
}
