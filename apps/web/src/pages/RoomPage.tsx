import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.js';
import { Button } from '../components/ui/Button.js';
import { emitWithAck } from '../lib/socket.js';
import { isPlayerView } from '../lib/view-merge.js';
import type { RoomJoinResult } from '@gostop/shared';
import { useGameStore } from '../store/game-store.js';

function gameHasStarted(room: { status: string; gameId?: string | null } | null | undefined): boolean {
  if (!room) return false;
  return room.status === 'IN_PROGRESS' || room.status === 'FINISHED' || Boolean(room.gameId);
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useGameStore((s) => s.user);
  const room = useGameStore((s) => s.room);
  const view = useGameStore((s) => s.view);
  const socketStatus = useGameStore((s) => s.socketStatus);
  const setRoom = useGameStore((s) => s.setRoom);
  const setSpectator = useGameStore((s) => s.setSpectator);
  const applySync = useGameStore((s) => s.applySync);
  const resetGame = useGameStore((s) => s.resetGame);
  const isSpectator = useGameStore((s) => s.isSpectator);

  const isSolo = useMemo(() => roomId?.startsWith('solo-') ?? false, [roomId]);
  const resetRoomRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    if (resetRoomRef.current === roomId) return;
    resetRoomRef.current = roomId;
    resetGame();
    setJoined(false);
    setReady(false);
    setError(null);
  }, [roomId, resetGame]);

  useEffect(() => {
    if (!roomId || !user || joined) return;
    if (socketStatus !== 'connected') return;

    let cancelled = false;

    emitWithAck<RoomJoinResult>('room:join', {
      roomId,
      asSpectator: joinAsSpectator,
      solo: isSolo && !joinAsSpectator,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'OK') {
          setJoined(true);
          setRoom(roomId, res.room);
          setSpectator(joinAsSpectator);
          if (res.sync) applySync(res.sync);
          if (isSolo) setReady(true);

          if (gameHasStarted(res.room) || (res.sync && isPlayerView(res.sync.view))) {
            navigate(`/game/${roomId}`, { replace: true });
          }
        } else {
          setError(res.status);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    user,
    joined,
    socketStatus,
    joinAsSpectator,
    isSolo,
    setRoom,
    setSpectator,
    applySync,
    navigate,
  ]);

  useEffect(() => {
    if (!roomId || !joined) return;
    const hasView = Boolean(view?.gameId);
    const started = gameHasStarted(room);
    if (started && (hasView || isSpectator || joinAsSpectator)) {
      navigate(`/game/${roomId}`, { replace: true });
    }
  }, [view, isSpectator, joinAsSpectator, room, roomId, joined, navigate]);

  useEffect(() => {
    if (!roomId || !joined || view?.gameId || socketStatus !== 'connected') return;
    if (!gameHasStarted(room)) return;

    let cancelled = false;
    emitWithAck<RoomJoinResult>('room:join', {
      roomId,
      asSpectator: joinAsSpectator,
      solo: isSolo && !joinAsSpectator,
    })
      .then((res) => {
        if (cancelled || res.status !== 'OK') return;
        setRoom(roomId, res.room);
        if (res.sync) applySync(res.sync);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [roomId, joined, view?.gameId, room, socketStatus, joinAsSpectator, isSolo, setRoom, applySync]);

  async function toggleReady() {
    if (!roomId) return;
    const next = !ready;
    await emitWithAck('room:ready', { roomId, ready: next });
    setReady(next);
  }

  if (!user) {
    navigate('/');
    return null;
  }

  const connecting = socketStatus === 'connecting' || (socketStatus === 'connected' && !joined && !error);
  const waitingForGame = joined && isSolo && !gameHasStarted(room);
  const missingAi = waitingForGame && !(room?.members ?? []).some((m) => m.isAi);

  return (
    <AppShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 py-6">
        <button type="button" className="mb-4 text-left text-sm text-stone-500 hover:text-stone-300" onClick={() => navigate('/lobby')}>
          ← 로비
        </button>

        <h1 className="font-display text-2xl text-white">{isSolo ? 'AI 대국' : '대기실'}</h1>
        <p className="mt-1 font-mono text-xs text-stone-500">{roomId}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {missingAi && (
          <p className="mt-2 text-sm text-amber-400">
            AI 상대를 불러오지 못했습니다. backend-game을 재시작한 뒤 새 혼자하기 방을 만들어 주세요.
          </p>
        )}
        {socketStatus === 'error' && !error && (
          <p className="mt-2 text-sm text-red-400">서버 연결에 실패했습니다. backend-game(포트 3001)을 확인해 주세요.</p>
        )}

        <div className="glass-panel mt-6 flex-1 rounded-2xl p-4">
          <p className="text-sm text-stone-400">
            {connecting
              ? '서버 연결 중…'
              : isSolo
                ? joined
                  ? gameHasStarted(room)
                    ? '게임 화면으로 이동 중…'
                    : 'AI와 게임을 준비 중…'
                  : '연결 중…'
                : room?.status === 'WAITING'
                  ? '플레이어를 기다리는 중…'
                  : room?.status ?? '연결 중…'}
          </p>
          <ul className="mt-4 space-y-2">
            {(room?.members ?? []).map((m) => (
              <li
                key={m.user.userId}
                className="flex items-center justify-between rounded-xl bg-black/25 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-700 text-sm font-bold">
                    {m.isAi ? '🤖' : m.user.nickname.slice(0, 1)}
                  </span>
                  <span className="font-medium text-stone-200">
                    {m.user.nickname}
                    {m.isAi && <span className="ml-1 text-xs text-amber-400">AI</span>}
                    {m.isSpectator && <span className="ml-1 text-xs text-violet-400">관전</span>}
                  </span>
                </div>
                <span className={m.ready ? 'text-sm font-bold text-emerald-400' : 'text-sm text-stone-600'}>
                  {m.ready ? '준비' : '대기'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!joined && import.meta.env.DEV && !isSolo && (
          <label className="mt-4 flex items-center gap-2 text-sm text-stone-500">
            <input type="checkbox" checked={joinAsSpectator} onChange={(e) => setJoinAsSpectator(e.target.checked)} />
            관전으로 입장
          </label>
        )}

        {joined && !joinAsSpectator && !isSolo && room?.status === 'WAITING' && (
          <Button
            variant={ready ? 'outline' : 'primary'}
            size="lg"
            className="mt-6 w-full py-4 font-display text-lg"
            onClick={toggleReady}
          >
            {ready ? '준비 취소' : '준비 완료'}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
