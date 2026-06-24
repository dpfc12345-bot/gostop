import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getLegalActions, hashState, type GameAction } from '@gostop/engine';
import type { EventStore } from '../persistence/event-store.interface.js';
import { recoverGameState } from '../persistence/game-recovery.js';
import { SNAPSHOT_INTERVAL } from '../config/constants.js';
import { createTestRoomManager } from './room-manager.js';

async function startTwoPlayerGame(
  manager: ReturnType<typeof createTestRoomManager>['manager'],
  baseRoomId = 'room-1',
): Promise<{ roomId: string; gameId: string; p0: string; p1: string }> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const roomId = attempt === 0 ? baseRoomId : `${baseRoomId}-${attempt}`;
    const room = manager.getOrCreate(roomId);
    const p0 = `user-a-${attempt}`;
    const p1 = `user-b-${attempt}`;
    await room.join({ userId: p0, socketId: `sock-a-${attempt}`, nickname: 'A' });
    await room.join({ userId: p1, socketId: `sock-b-${attempt}`, nickname: 'B' });
    await room.setReady(p0, true);
    await room.setReady(p1, true);
    if (room.gameId && room.state?.phase !== 'FINISHED') {
      return { roomId, gameId: room.gameId, p0, p1 };
    }
  }
  throw new Error('could not start a playable game (chongtong retries exhausted)');
}

function pickAction(
  state: NonNullable<ReturnType<typeof createTestRoomManager>['manager']['getOrCreate']>['state'],
): GameAction {
  const legal = getLegalActions(state!);
  if (legal.length === 0) throw new Error('no legal actions');
  const stop = legal.find((a) => a.type === 'DECLARE_STOP');
  if (stop) return stop;
  const go = legal.find((a) => a.type === 'DECLARE_GO');
  if (go) return go;
  const play = legal.find((a) => a.type === 'PLAY_CARD');
  if (play) return play;
  const choose = legal.find((a) => a.type === 'CHOOSE_MATCH');
  if (choose) return choose;
  const bomb = legal.find((a) => a.type === 'PLAY_BOMB');
  if (bomb) return bomb;
  return legal[0]!;
}

describe('RoomActor — solo vs AI', () => {
  it('starts with one human + AI and AI takes scheduled turns', async () => {
    vi.useFakeTimers();
    try {
      const { manager } = createTestRoomManager();
      const room = manager.getOrCreate('solo-test');
      const human = 'solo-human';

      const result = await room.join({
        userId: human,
        socketId: 'sock-solo',
        nickname: '나',
        solo: true,
      });

      expect(result.status).toBe('OK');
      expect(result.room.members).toHaveLength(2);
      expect(result.room.members.some((m) => m.isAi)).toBe(true);
      expect(room.gameId).toBeTruthy();
      expect(room.state?.phase).not.toBe('FINISHED');
      expect(result.sync).toBeDefined();

      const aiMember = result.room.members.find((m) => m.isAi);
      expect(aiMember?.ready).toBe(true);

      let steps = 0;
      const maxSteps = 600;
      while (room.state?.phase !== 'FINISHED' && steps < maxSteps) {
        const turn = room.state!.turn;
        const aiSeat = aiMember?.seat;
        if (turn === aiSeat) {
          await vi.advanceTimersByTimeAsync(900);
        } else {
          const action = pickAction(room.state);
          const ack = await room.handleAction(
            { gameId: room.gameId!, actionId: randomUUID(), action },
            human,
          );
          expect(ack.status).toBe('APPLIED');
        }
        steps++;
      }

      expect(room.state?.phase).toBe('FINISHED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts a new game when rejoining a finished solo room', async () => {
    const { manager } = createTestRoomManager();
    const room = manager.getOrCreate('solo-rematch');

    const first = await room.join({
      userId: 'solo-human-rematch',
      socketId: 'sock-solo-rematch-1',
      nickname: '나',
      solo: true,
    });
    expect(first.status).toBe('OK');
    const oldGameId = room.gameId;
    expect(oldGameId).toBeTruthy();

    room.status = 'FINISHED';
    if (room.state) {
      room.state = { ...room.state, phase: 'FINISHED' };
    }

    const second = await room.join({
      userId: 'solo-human-rematch',
      socketId: 'sock-solo-rematch-2',
      nickname: '나',
      solo: true,
    });
    expect(second.status).toBe('OK');
    expect(room.gameId).not.toBe(oldGameId);
    expect(room.state?.phase).not.toBe('FINISHED');
    expect(second.sync).toBeDefined();
  });

  it('starts from solo- room id without solo flag', async () => {
    const { manager } = createTestRoomManager();
    const room = manager.getOrCreate('solo-room-id-test');

    const result = await room.join({
      userId: 'solo-human-2',
      socketId: 'sock-solo-2',
      nickname: '나',
    });

    expect(result.status).toBe('OK');
    expect(result.room.members).toHaveLength(2);
    expect(result.room.members.some((m) => m.isAi)).toBe(true);
    expect(room.gameId).toBeTruthy();
  });
});

describe('RoomActor — full 2-player game', () => {
  it('plays from deal through stop/settlement to FINISHED', async () => {
    const { manager } = createTestRoomManager();
    const { roomId, gameId, p0, p1 } = await startTwoPlayerGame(manager);
    const room = manager.getOrCreate(roomId);

    let steps = 0;
    const maxSteps = 500;
    while (room.state?.phase !== 'FINISHED' && steps < maxSteps) {
      const turn = room.state!.turn;
      const userId = turn === 0 ? p0 : p1;
      const action = pickAction(room.state);
      const ack = await room.handleAction(
        { gameId, actionId: randomUUID(), action },
        userId,
      );
      expect(ack.status).toBe('APPLIED');
      steps++;
    }

    expect(room.state?.phase).toBe('FINISHED');
    expect(room.state?.winner).not.toBeNull();
    expect(room.eventSeq).toBeGreaterThan(0);
  });
});

describe('RoomActor — actionId dedup', () => {
  it('returns DUPLICATE on retry without mutating seq', async () => {
    const { manager } = createTestRoomManager();
    const { gameId, p0, p1, roomId } = await startTwoPlayerGame(manager);
    const room = manager.getOrCreate(roomId);
    const turn = room.state!.turn;
    const userId = turn === 0 ? p0 : p1;
    const action = pickAction(room.state);
    const actionId = randomUUID();
    const envelope = { gameId, actionId, action };

    const first = await room.handleAction(envelope, userId);
    expect(first.status).toBe('APPLIED');
    const seqAfter = room.eventSeq;

    const second = await room.handleAction(envelope, userId);
    expect(second.status).toBe('DUPLICATE');
    expect(room.eventSeq).toBe(seqAfter);
  });
});

describe('RoomActor — EventStore failure', () => {
  it('does not advance state when append throws', async () => {
    const base = createTestRoomManager();
    const { snapshotStore, broadcaster } = base;

    const inner = new (await import('../persistence/in-memory-event-store.js')).InMemoryEventStore();
    let appendCount = 0;
    const failingStore: EventStore = {
      async append(gameId, entries) {
        appendCount++;
        if (appendCount > 1) throw new Error('simulated persistence failure');
        return inner.append(gameId, entries);
      },
      loadFrom: (g, f) => inner.loadFrom(g, f),
      getLatestSeq: (g) => inner.getLatestSeq(g),
    };

    const { RoomActor } = await import('./room-actor.js');
    const { InMemoryLockService } = await import('../redis/in-memory-lock.service.js');
    const { InMemoryActionDedupService } = await import('../redis/action-dedup.service.js');
    const { gameEngine } = await import('@gostop/engine');

    let room!: InstanceType<typeof RoomActor>;
    for (let attempt = 0; attempt < 15; attempt++) {
      room = new RoomActor(`fail-room-${attempt}`, {
        eventStore: failingStore,
        snapshotStore,
        lock: new InMemoryLockService(),
        actionDedup: new InMemoryActionDedupService(),
        broadcaster,
        engine: gameEngine,
      });
      await room.join({ userId: 'u0', socketId: `s0-${attempt}`, nickname: 'P0' });
      await room.join({ userId: 'u1', socketId: `s1-${attempt}`, nickname: 'P1' });
      await room.setReady('u0', true);
      await room.setReady('u1', true);
      if (room.state?.phase !== 'FINISHED') break;
    }
    expect(room.state?.phase).not.toBe('FINISHED');

    const hashAfterDeal = hashState(room.state!);
    const seqAfterDeal = room.eventSeq;

    const turn = room.state!.turn;
    const userId = turn === 0 ? 'u0' : 'u1';
    const ack = await room.handleAction(
      { gameId: room.gameId!, actionId: randomUUID(), action: pickAction(room.state) },
      userId,
    );

    expect(ack.status).toBe('REJECTED');
    expect(hashState(room.state!)).toBe(hashAfterDeal);
    expect(room.eventSeq).toBe(seqAfterDeal);
  });
});

describe('RoomActor — resume & spectator', () => {
  it('resumes with DIFF then SYNC; spectator gets spectator view', async () => {
    const { manager } = createTestRoomManager();
    const { gameId, p0, p1, roomId } = await startTwoPlayerGame(manager);
    const room = manager.getOrCreate(roomId);

    await room.join({ userId: 'spec', socketId: 'sock-spec', nickname: 'Spec', asSpectator: true });
    const sync = room.resume({ gameId, lastSeq: room.eventSeq }, 'spec');
    expect(sync.status).toBe('SYNC');
    if (sync.status === 'SYNC') {
      expect(sync.sync.view).toBeDefined();
      expect('players' in sync.sync.view).toBe(true);
      expect('self' in sync.sync.view).toBe(false);
    }

    const lastSeq = -1;
    const resumed = room.resume({ gameId, lastSeq }, p0);
    expect(['SYNC', 'DIFF']).toContain(resumed.status);

    const action = pickAction(room.state);
    await room.handleAction({ gameId, actionId: randomUUID(), action }, p0);

    const diffResume = room.resume({ gameId, lastSeq: room.eventSeq - 1 }, p1);
    expect(['SYNC', 'DIFF']).toContain(diffResume.status);
    void p1;
  });
});

describe('Server restart recovery', () => {
  it('restores state from EventStore + Snapshot with matching StateHash', async () => {
    const { manager, eventStore, snapshotStore, broadcaster } = createTestRoomManager();
    const { roomId, gameId, p0, p1 } = await startTwoPlayerGame(manager);
    const room = manager.getOrCreate(roomId);

    for (let i = 0; i < 30 && room.state?.phase !== 'FINISHED'; i++) {
      const turn = room.state!.turn;
      const userId = turn === 0 ? p0 : p1;
      await room.handleAction(
        { gameId, actionId: randomUUID(), action: pickAction(room.state) },
        userId,
      );
    }

    const liveHash = hashState(room.state!);
    const liveSeq = room.eventSeq;

    if ((liveSeq + 1) % SNAPSHOT_INTERVAL !== 0) {
      await snapshotStore.save({
        gameId,
        seq: liveSeq,
        state: room.state!,
        stateHash: liveHash,
        phase: room.state!.phase,
      });
    }

    const { RoomActor } = await import('./room-actor.js');
    const { InMemoryLockService } = await import('../redis/in-memory-lock.service.js');
    const { InMemoryActionDedupService } = await import('../redis/action-dedup.service.js');
    const { gameEngine } = await import('@gostop/engine');

    const recovered = await RoomActor.recover(roomId, gameId, {
      eventStore,
      snapshotStore,
      lock: new InMemoryLockService(),
      actionDedup: new InMemoryActionDedupService(),
      broadcaster,
      engine: gameEngine,
    });

    const viaRecovery = await recoverGameState(gameId, eventStore, snapshotStore);
    expect(hashState(recovered.state!)).toBe(liveHash);
    expect(viaRecovery.stateHash).toBe(liveHash);
    expect(recovered.eventSeq).toBe(liveSeq);
  });
});

describe('Snapshot cadence', () => {
  it('creates a snapshot every N events (interval configurable)', async () => {
    const interval = 8;
    const { manager, snapshotStore } = createTestRoomManager(interval);
    const { roomId, gameId, p0, p1 } = await startTwoPlayerGame(manager);
    const room = manager.getOrCreate(roomId);

    let safety = 0;
    while (
      !snapshotStore.dump(gameId).some((s) => (s.seq + 1) % interval === 0) &&
      room.state?.phase !== 'FINISHED' &&
      safety++ < 100
    ) {
      const turn = room.state!.turn;
      await room.handleAction(
        { gameId, actionId: randomUUID(), action: pickAction(room.state) },
        turn === 0 ? p0 : p1,
      );
    }

    const snaps = snapshotStore.dump(gameId);
    expect(snaps.some((s) => (s.seq + 1) % interval === 0)).toBe(true);
  });
});
