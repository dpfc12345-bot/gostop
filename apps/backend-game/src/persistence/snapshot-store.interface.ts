import type { GameState } from '@gostop/engine';

export interface StoredSnapshot {
  seq: number;
  state: GameState;
  stateHash: string;
  phase: string;
}

export interface SnapshotStore {
  save(snapshot: StoredSnapshot & { gameId: string }): Promise<void>;
  loadLatest(gameId: string): Promise<StoredSnapshot | null>;
}
