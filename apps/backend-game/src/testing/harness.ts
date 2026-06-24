import { randomUUID } from 'node:crypto';
import {
  applyEvent,
  getLegalActions,
  hashState,
  initialStateForReplay,
  replayEvents,
  type GameAction,
  type GameState,
} from '@gostop/engine';
import type { GameSyncMsg, StateDiffMsg } from '@gostop/shared';
import type { InMemoryBroadcaster } from '../broadcast/in-memory-broadcaster.js';
import { recoverGameState } from '../persistence/game-recovery.js';
import type { InMemoryEventStore } from '../persistence/in-memory-event-store.js';
import { createTestRoomManager } from '../room/room-manager.js';
import type { RoomActor } from '../room/room-actor.js';
import type { RoomManager } from '../room/room-manager.js';

export interface GameSession {
  roomId: string;
  gameId: string;
  p0: string;
  p1: string;
  room: RoomActor;
}

export type TestHarness = ReturnType<typeof createTestRoomManager>;

/** Prefer stop/go/card play — exercises full server pipeline deterministically. */
export function pickAction(state: GameState): GameAction {
  const legal = getLegalActions(state);
  if (legal.length === 0) throw new Error('no legal actions');
  const stop = legal.find((a) => a.type === 'DECLARE_STOP');
  if (stop) return stop;
  const go = legal.find((a) => a.type === 'DECLARE_GO');
  if (go) return go;
  const shake = legal.find((a) => a.type === 'DECLARE_SHAKE');
  if (shake) return shake;
  const bomb = legal.find((a) => a.type === 'PLAY_BOMB');
  if (bomb) return bomb;
  const play = legal.find((a) => a.type === 'PLAY_CARD');
  if (play) return play;
  const choose = legal.find((a) => a.type === 'CHOOSE_MATCH');
  if (choose) return choose;
  return legal[0]!;
}

export async function startSeededTwoPlayerGame(
  harness: TestHarness,
  seed: string,
  roomId = `room-${seed}`,
): Promise<GameSession> {
  const { manager } = harness;
  const room = manager.getOrCreate(roomId);
  const p0 = `user-a-${seed}`;
  const p1 = `user-b-${seed}`;

  // Re-bind seed on each attempt via harness seedFactory (set at creation).
  await room.join({ userId: p0, socketId: `sock-a-${seed}`, nickname: 'A' });
  await room.join({ userId: p1, socketId: `sock-b-${seed}`, nickname: 'B' });
  await room.setReady(p0, true);
  await room.setReady(p1, true);

  if (!room.gameId || !room.state) {
    throw new Error(`game did not start for seed ${seed}`);
  }
  return { roomId, gameId: room.gameId, p0, p1, room };
}

export function createSeededHarness(seed: string, snapshotInterval?: number): TestHarness {
  return createTestRoomManager(snapshotInterval, () => seed);
}

export async function playToCompletion(
  session: GameSession,
  maxSteps = 600,
): Promise<{ steps: number; finalHash: string }> {
  const { room, gameId, p0, p1 } = session;
  let steps = 0;

  while (room.state?.phase !== 'FINISHED' && steps < maxSteps) {
    const turn = room.state!.turn;
    const userId = turn === 0 ? p0 : p1;
    const ack = await room.handleAction(
      { gameId, actionId: randomUUID(), action: pickAction(room.state!) },
      userId,
    );
    if (ack.status !== 'APPLIED' && ack.status !== 'DUPLICATE') {
      throw new Error(`action rejected at step ${steps}: ${ack.status}`);
    }
    steps++;
  }

  if (room.state?.phase !== 'FINISHED') {
    throw new Error(`game did not finish within ${maxSteps} steps (seed stuck?)`);
  }

  return { steps, finalHash: hashState(room.state) };
}

/** EventStore replay must match live RoomActor state + hash. */
export async function verifyReplayFromEventStore(
  gameId: string,
  eventStore: InMemoryEventStore,
  snapshotStore: TestHarness['snapshotStore'],
  liveState: GameState,
): Promise<void> {
  const recovered = await recoverGameState(gameId, eventStore, snapshotStore);
  if (hashState(recovered.state) !== hashState(liveState)) {
    throw new Error('recoverGameState hash mismatch vs live state');
  }

  const all = await eventStore.loadFrom(gameId, 0);
  const replayed = replayEvents(
    initialStateForReplay(),
    all.map((e) => e.event),
    applyEvent,
  );
  const replayedWithId = { ...replayed, gameId };
  if (hashState(replayedWithId) !== hashState(liveState)) {
    throw new Error('replayEvents hash mismatch vs live state');
  }
}

/** Final broadcast sync/diff hashes must match authoritative live state. */
export function verifyBroadcastStateHashes(
  broadcaster: InMemoryBroadcaster,
  liveState: GameState,
  socketIds: string[],
): void {
  const expected = hashState(liveState);

  for (const socketId of socketIds) {
    const syncs = broadcaster.messages.filter(
      (m) => m.socketId === socketId && m.event === 'game:sync',
    );
    const lastSync = syncs[syncs.length - 1]?.payload as GameSyncMsg | undefined;
    if (lastSync && lastSync.stateHash !== expected) {
      throw new Error(`final game:sync hash mismatch for ${socketId}`);
    }

    const diffs = broadcaster.messages.filter(
      (m) => m.socketId === socketId && m.event === 'game:diff',
    );
    const lastDiff = diffs[diffs.length - 1]?.payload as StateDiffMsg | undefined;
    if (lastDiff && lastDiff.stateHash !== expected) {
      throw new Error(`final game:diff hash mismatch for ${socketId}`);
    }
  }
}

export function verifyResumeFlow(
  room: RoomActor,
  gameId: string,
  playerUserId: string,
  spectatorUserId: string,
): void {
  const specSync = room.resume({ gameId, lastSeq: room.eventSeq }, spectatorUserId);
  if (specSync.status !== 'SYNC') throw new Error('spectator resume expected SYNC');
  if (specSync.status === 'SYNC') {
    const view = specSync.sync.view;
    if ('self' in view) throw new Error('spectator sync must not expose self');
    if (!('players' in view)) throw new Error('spectator sync must expose players');
  }

  const fullSync = room.resume({ gameId, lastSeq: -1 }, playerUserId);
  if (fullSync.status !== 'SYNC' && fullSync.status !== 'DIFF') {
    throw new Error(`player resume expected SYNC/DIFF, got ${fullSync.status}`);
  }

  const catchUp = room.resume({ gameId, lastSeq: Math.max(-1, room.eventSeq - 1) }, playerUserId);
  if (!['SYNC', 'DIFF'].includes(catchUp.status)) {
    throw new Error(`catch-up resume failed: ${catchUp.status}`);
  }
  if (catchUp.status === 'SYNC' && catchUp.sync.stateHash !== hashState(room.state!)) {
    throw new Error('resume SYNC stateHash mismatch');
  }
  if (catchUp.status === 'DIFF') {
    const last = catchUp.diffs[catchUp.diffs.length - 1];
    if (last?.stateHash !== hashState(room.state!)) {
      throw new Error('resume DIFF final stateHash mismatch');
    }
  }
}

export async function verifySpectatorCannotAct(
  room: RoomActor,
  gameId: string,
  spectatorUserId: string,
): Promise<void> {
  if (!room.state) throw new Error('no state');
  const ack = await room.handleAction(
    {
      gameId,
      actionId: randomUUID(),
      action: pickAction(room.state),
    },
    spectatorUserId,
  );
  if (ack.status !== 'REJECTED') {
    throw new Error('spectator action must be REJECTED');
  }
}

export type { RoomManager };
