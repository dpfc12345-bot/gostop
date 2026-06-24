import type { SnapshotStore, StoredSnapshot } from './snapshot-store.interface.js';

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snaps = new Map<string, StoredSnapshot[]>();

  async save(snapshot: StoredSnapshot & { gameId: string }): Promise<void> {
    const list = this.snaps.get(snapshot.gameId) ?? [];
    const existing = list.findIndex((s) => s.seq === snapshot.seq);
    const row: StoredSnapshot = {
      seq: snapshot.seq,
      state: snapshot.state,
      stateHash: snapshot.stateHash,
      phase: snapshot.phase,
    };
    if (existing >= 0) list[existing] = row;
    else list.push(row);
    list.sort((a, b) => a.seq - b.seq);
    this.snaps.set(snapshot.gameId, list);
  }

  async loadLatest(gameId: string): Promise<StoredSnapshot | null> {
    const list = this.snaps.get(gameId) ?? [];
    return list.length > 0 ? list[list.length - 1]! : null;
  }

  dump(gameId: string): readonly StoredSnapshot[] {
    return [...(this.snaps.get(gameId) ?? [])];
  }
}
