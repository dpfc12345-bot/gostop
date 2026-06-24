import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RoomJoinResult } from '@gostop/shared';
import { DevPanel } from '../components/dev/DevPanel.js';
import { DecisionModal } from '../components/game/DecisionModal.js';
import { EffectOverlay } from '../components/game/EffectOverlay.js';
import { GameTable } from '../components/game/GameTable.js';
import { GoStopOverlay } from '../components/game/GoStopOverlay.js';
import { KukjinOverlay } from '../components/game/KukjinOverlay.js';
import { VictoryScreen } from '../components/game/VictoryScreen.js';
import { GameShell } from '../components/layout/GameShell.js';
import { useGameActions } from '../hooks/useGameActions.js';
import { useSound } from '../hooks/useSound.js';
import { emitWithAck } from '../lib/socket.js';
import { playSound } from '../lib/sounds.js';
import { useGameStore } from '../store/game-store.js';

function gameHasStarted(room: { status: string; gameId?: string | null } | null | undefined): boolean {
  if (!room) return false;
  return room.status === 'IN_PROGRESS' || room.status === 'FINISHED' || Boolean(room.gameId);
}

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useGameStore((s) => s.user);
  const view = useGameStore((s) => s.view);
  const legalActions = useGameStore((s) => s.legalActions);
  const gameResult = useGameStore((s) => s.gameResult);
  const isSpectator = useGameStore((s) => s.isSpectator);
  const room = useGameStore((s) => s.room);
  const applySync = useGameStore((s) => s.applySync);
  const setRoom = useGameStore((s) => s.setRoom);

  const [rejoining, setRejoining] = useState(false);
  const { sendAction } = useGameActions();
  const { muted, toggleMute, play } = useSound();

  useEffect(() => {
    if (gameResult) playSound('win');
  }, [gameResult]);

  const isSolo = roomId?.startsWith('solo-') ?? false;

  useEffect(() => {
    if (!roomId || !user || view || isSpectator || rejoining) return;
    if (!gameHasStarted(room)) {
      navigate(`/room/${roomId}`, { replace: true });
      return;
    }

    setRejoining(true);
    emitWithAck<RoomJoinResult>('room:join', {
      roomId,
      asSpectator: false,
      solo: isSolo,
    })
      .then((res) => {
        if (res.status === 'OK') {
          setRoom(roomId, res.room);
          if (res.sync) applySync(res.sync);
        }
      })
      .finally(() => setRejoining(false));
  }, [roomId, user, view, isSpectator, rejoining, room, isSolo, navigate, applySync, setRoom]);

  if (!user) {
    navigate('/');
    return null;
  }

  if (!view && !isSpectator) {
    return (
      <GameShell title="게임 로딩">
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse text-stone-400">{rejoining ? '동기화 중…' : '준비 중…'}</p>
        </div>
        {import.meta.env.DEV && <DevPanel />}
      </GameShell>
    );
  }

  if (isSpectator || !view) {
    return (
      <GameShell title="관전" onBack={() => navigate(`/room/${roomId}`)}>
        <p className="p-4 text-center text-stone-400">관전 모드입니다.</p>
        {import.meta.env.DEV && <DevPanel />}
      </GameShell>
    );
  }

  const goStopPending =
    view.pending?.kind === 'GO_OR_STOP' && view.pending.seat === view.self.seat;
  const kukjinPending =
    view.pending?.kind === 'CHOOSE_KUKJIN' && view.pending.seat === view.self.seat;

  return (
    <GameShell
      title="고스톱"
      subtitle={user.nickname}
      onBack={() => navigate('/lobby')}
      soundMuted={muted}
      onToggleSound={toggleMute}
      immersive
    >
      <GameTable
        view={view}
        onPlayCard={(cardId) => {
          play('play');
          sendAction({ type: 'PLAY_CARD', seat: view.self.seat, cardId });
        }}
        onChooseMatch={(targetCardId) => {
          play('tap');
          sendAction({ type: 'CHOOSE_MATCH', seat: view.self.seat, targetCardId });
        }}
      />

      <DecisionModal view={view} legalActions={legalActions} onAction={sendAction} />

      {goStopPending && (
        <GoStopOverlay
          view={view}
          onGo={() => {
            play('go');
            sendAction({ type: 'DECLARE_GO', seat: view.self.seat });
          }}
          onStop={() => {
            play('stop');
            sendAction({ type: 'DECLARE_STOP', seat: view.self.seat });
          }}
        />
      )}

      {kukjinPending && (
        <KukjinOverlay
          view={view}
          onChoose={(asDoubleJunk) => {
            play('tap');
            sendAction({ type: 'CHOOSE_KUKJIN', seat: view.self.seat, asDoubleJunk });
          }}
        />
      )}

      <EffectOverlay />
      {gameResult && <VictoryScreen result={gameResult} mySeat={view.self.seat} />}
      {import.meta.env.DEV && <DevPanel />}
    </GameShell>
  );
}
