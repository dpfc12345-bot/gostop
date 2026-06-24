import { io, type Socket } from 'socket.io-client';
import { SOCKET_NAMESPACES, type ClientToServerEvents, type ServerToClientEvents } from '@gostop/shared';
import type { DevUser } from './storage.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const GAME_NS = SOCKET_NAMESPACES.game;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket | null {
  return socket;
}

function socketUser(s: GameSocket): DevUser | null {
  const q = s.io.opts.query;
  if (!q || typeof q !== 'object') return null;
  const { userId, nickname } = q as Record<string, string>;
  if (!userId) return null;
  return { userId, nickname: nickname ?? '' };
}

export function connectGameSocket(user: DevUser): GameSocket {
  if (socket) {
    const existing = socketUser(socket);
    if (existing?.userId === user.userId && existing.nickname === user.nickname) {
      if (!socket.connected) socket.connect();
      return socket;
    }
    socket.disconnect();
    socket = null;
  }

  const url = import.meta.env.VITE_GAME_SERVER_URL ?? '';
  socket = io(`${url}${GAME_NS}`, {
    transports: ['websocket', 'polling'],
    query: {
      userId: user.userId,
      nickname: user.nickname,
    },
    autoConnect: true,
  }) as GameSocket;

  return socket;
}

export function disconnectGameSocket(): void {
  socket?.disconnect();
  socket = null;
}

/** Wait until the game socket exists and is connected (handles Strict Mode + async connect). */
export function waitForConnectedSocket(timeoutMs = 15000): Promise<GameSocket> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let connectHandler: (() => void) | null = null;
    let tracked: GameSocket | null = null;

    const cleanup = () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (tracked && connectHandler) tracked.off('connect', connectHandler);
      pollTimer = null;
      connectHandler = null;
      tracked = null;
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    const attempt = () => {
      const s = getSocket();
      if (s?.connected) {
        cleanup();
        resolve(s);
        return;
      }
      if (Date.now() >= deadline) {
        fail('서버 연결 시간이 초과되었습니다. backend-game이 실행 중인지 확인해 주세요.');
        return;
      }
      if (s && s !== tracked) {
        if (tracked && connectHandler) tracked.off('connect', connectHandler);
        tracked = s;
        connectHandler = () => attempt();
        s.on('connect', connectHandler);
      }
      pollTimer = setTimeout(attempt, 50);
    };

    attempt();
  });
}

export async function emitWithAck<T>(
  event: keyof ClientToServerEvents,
  payload: unknown,
  timeoutMs = 15000,
): Promise<T> {
  const s = await waitForConnectedSocket(timeoutMs);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('서버 응답 시간이 초과되었습니다.'));
    }, timeoutMs);

    const handler = s as unknown as {
      emit: (ev: string, data: unknown, cb: (res: T) => void) => void;
    };
    handler.emit(event as string, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export { GAME_NS };
