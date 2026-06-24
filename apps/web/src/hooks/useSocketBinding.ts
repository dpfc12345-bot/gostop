import { useEffect } from 'react';
import type { RoomStateMsg } from '@gostop/shared';
import { connectGameSocket, disconnectGameSocket, getSocket } from '../lib/socket.js';
import { useGameStore } from '../store/game-store.js';
import type { DevUser } from '../lib/storage.js';

/** Wire Socket.IO events to the zustand store (PlayerView only on the client). */
export function useSocketBinding(user: DevUser | null): void {
  const applySync = useGameStore((s) => s.applySync);
  const applyDiff = useGameStore((s) => s.applyDiff);
  const setLegalActions = useGameStore((s) => s.setLegalActions);
  const setGameResult = useGameStore((s) => s.setGameResult);
  const setRoom = useGameStore((s) => s.setRoom);
  const setSocketStatus = useGameStore((s) => s.setSocketStatus);
  const log = useGameStore((s) => s.log);

  useEffect(() => {
    if (!user) return;

    setSocketStatus('connecting');
    const socket = connectGameSocket(user);

    const onConnect = () => {
      setSocketStatus('connected');
      log({ kind: 'SOCKET', summary: 'connected' });
    };
    const onDisconnect = (reason: string) => {
      setSocketStatus('disconnected');
      log({ kind: 'SOCKET', summary: `disconnected: ${reason}` });
    };
    const onConnectError = (err: Error) => {
      setSocketStatus('error', err.message);
      log({ kind: 'SOCKET', summary: `error: ${err.message}` });
    };
    const onRoomState = (msg: RoomStateMsg) => {
      setRoom(msg.roomId, msg);
      log({ kind: 'ROOM', summary: `room ${msg.status}`, payload: msg });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:state', onRoomState);
    socket.on('game:sync', (msg) => applySync(msg));
    socket.on('game:diff', (msg) => applyDiff(msg));
    socket.on('game:decision', (msg) => setLegalActions(msg.legalActions));
    socket.on('game:ended', (msg) => setGameResult(msg));
    socket.on('error', (msg) => log({ kind: 'SOCKET', summary: msg.message, payload: msg }));

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room:state', onRoomState);
      socket.off('game:sync');
      socket.off('game:diff');
      socket.off('game:decision');
      socket.off('game:ended');
      socket.off('error');
    };
  }, [user, applySync, applyDiff, setLegalActions, setGameResult, setRoom, setSocketStatus, log]);

  useEffect(() => {
    if (user) return;
    disconnectGameSocket();
    setSocketStatus('disconnected');
  }, [user, setSocketStatus]);

  void getSocket;
}
