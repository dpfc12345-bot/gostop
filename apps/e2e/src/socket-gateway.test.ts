import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import {
  SOCKET_NAMESPACES,
  type ClientToServerEvents,
  type GameSyncMsg,
  type RoomJoinResult,
  type ResumeResult,
  type ServerToClientEvents,
  type StateDiffMsg,
} from '@gostop/shared';
import { createGameServer, type GameServerHandle } from '@gostop/backend-game/testing';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function connectClient(port: number, userId: string, nickname: string): Promise<GameSocket> {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}${SOCKET_NAMESPACES.game}`, {
      transports: ['websocket'],
      query: { userId, nickname },
    }) as GameSocket;
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitAck<T>(socket: GameSocket, event: keyof ClientToServerEvents, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout: ${String(event)}`)), 15_000);
    const handler = socket as unknown as {
      emit: (ev: string, data: unknown, cb: (res: T) => void) => void;
    };
    handler.emit(event as string, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function waitForGameStart(socket: GameSocket): Promise<{ gameId: string; stateHash: string; seq: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('game start timeout')), 15_000);
    const done = (gameId: string, stateHash: string | undefined, seq: number) => {
      if (!stateHash) return;
      clearTimeout(timer);
      resolve({ gameId, stateHash, seq });
    };
    socket.once('game:sync', (msg: GameSyncMsg) => done(msg.gameId, msg.stateHash, msg.seq));
    socket.once('game:diff', (msg: StateDiffMsg) => done(msg.gameId, msg.stateHash, msg.toSeq));
  });
}

describe('E2E — Socket gateway (real Socket.IO)', () => {
  let server: GameServerHandle;
  const seed = getE2ESeedCatalog().playableSeeds[0]!;

  beforeAll(async () => {
    process.env.GOSTOP_E2E_SEED = seed;
    server = await createGameServer(0);
  });

  afterAll(async () => {
    delete process.env.GOSTOP_E2E_SEED;
    await server.close();
  });

  it('join → ready → sync/diff stateHash + session:resume over real sockets', async () => {
    const roomId = `socket-e2e-${seed}`;
    const p0 = await connectClient(server.port, 'socket-p0', 'P0');
    const p1 = await connectClient(server.port, 'socket-p1', 'P1');
    const spec = await connectClient(server.port, 'socket-spec', 'Spec');

    const join0 = await emitAck<RoomJoinResult>(p0, 'room:join', { roomId, asSpectator: false });
    expect(join0.status).toBe('OK');

    await emitAck(p1, 'room:join', { roomId, asSpectator: false });
    await emitAck<RoomJoinResult>(spec, 'room:join', { roomId, asSpectator: true });

    await emitAck(p0, 'room:ready', { roomId, ready: true });

    const startPromise = waitForGameStart(p0);
    await emitAck(p1, 'room:ready', { roomId, ready: true });
    const start = await startPromise;

    expect(start.stateHash).toMatch(/^[a-f0-9]{64}$/);

    const specSync = await emitAck<ResumeResult>(spec, 'session:resume', {
      gameId: start.gameId,
      lastSeq: start.seq,
    });
    expect(specSync.status).toBe('SYNC');
    if (specSync.status === 'SYNC') {
      expect('players' in specSync.sync.view).toBe(true);
      expect('self' in specSync.sync.view).toBe(false);
      expect(specSync.sync.stateHash).toBe(start.stateHash);
    }

    const resumed = await emitAck<ResumeResult>(p1, 'session:resume', {
      gameId: start.gameId,
      lastSeq: -1,
    });
    expect(['SYNC', 'DIFF']).toContain(resumed.status);

    p0.disconnect();
    p1.disconnect();
    spec.disconnect();
  });
});
