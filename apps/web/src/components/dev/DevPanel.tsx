import { useState } from 'react';
import { useGameStore } from '../../store/game-store.js';

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'events' | 'replay' | 'socket' | 'resume' | 'spectator'>('events');

  const eventLog = useGameStore((s) => s.eventLog);
  const replayFrames = useGameStore((s) => s.replayFrames);
  const socketStatus = useGameStore((s) => s.socketStatus);
  const socketError = useGameStore((s) => s.socketError);
  const stateHash = useGameStore((s) => s.stateHash);
  const eventSeq = useGameStore((s) => s.eventSeq);
  const spectatorView = useGameStore((s) => s.spectatorView);
  const view = useGameStore((s) => s.view);
  const roomId = useGameStore((s) => s.roomId);
  const applyResume = useGameStore((s) => s.applyResume);

  const [replayIdx, setReplayIdx] = useState(0);
  const [resumeSeq, setResumeSeq] = useState(0);

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-violet-700 px-4 py-2 text-sm shadow-lg"
        onClick={() => setOpen(true)}
      >
        Dev
      </button>
    );
  }

  const tabs = ['events', 'replay', 'socket', 'resume', 'spectator'] as const;

  return (
    <aside className="fixed right-0 top-0 z-[80] flex h-full w-full max-w-sm flex-col border-l border-violet-900/50 bg-stone-950/95 shadow-2xl backdrop-blur sm:max-w-md">
      <header className="flex items-center justify-between border-b border-stone-800 p-3">
        <span className="text-sm font-semibold text-violet-300">Developer Panel</span>
        <button type="button" className="text-stone-500 hover:text-stone-300" onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>

      <div className="border-b border-stone-800 px-2 py-1 font-mono text-[10px] text-emerald-400/90">
        seq {eventSeq} · hash {stateHash?.slice(0, 16) ?? '—'}…
      </div>

      <nav className="flex gap-1 border-b border-stone-800 p-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded px-2 py-1 text-xs capitalize ${tab === t ? 'bg-violet-800 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-3 text-xs">
        {tab === 'events' && (
          <ul className="space-y-1">
            {[...eventLog].reverse().map((e) => (
              <li key={e.id} className="rounded border border-stone-800 bg-stone-900/50 p-2">
                <span className="text-violet-400">{e.kind}</span>{' '}
                <span className="text-stone-400">{new Date(e.at).toLocaleTimeString()}</span>
                <div className="text-stone-300">{e.summary}</div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'replay' && (
          <div>
            <input
              type="range"
              min={0}
              max={Math.max(0, replayFrames.length - 1)}
              value={replayIdx}
              className="w-full"
              onChange={(e) => setReplayIdx(Number(e.target.value))}
            />
            <p className="mt-2 text-stone-400">
              Frame {replayIdx + 1}/{replayFrames.length} · seq {replayFrames[replayIdx]?.seq ?? '—'}
            </p>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-stone-900 p-2 text-[10px]">
              {JSON.stringify(replayFrames[replayIdx]?.events ?? [], null, 2)}
            </pre>
            <p className="mt-2 text-stone-500">
              view: {replayFrames[replayIdx]?.view ? 'PlayerView snapshot' : 'null'}
            </p>
          </div>
        )}

        {tab === 'socket' && (
          <dl className="space-y-2">
            <div>
              <dt className="text-stone-500">Status</dt>
              <dd className={socketStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}>
                {socketStatus}
              </dd>
            </div>
            {socketError && (
              <div>
                <dt className="text-stone-500">Error</dt>
                <dd className="text-red-400">{socketError}</dd>
              </div>
            )}
            <div>
              <dt className="text-stone-500">Room</dt>
              <dd>{roomId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">State Hash (full)</dt>
              <dd className="break-all font-mono text-[10px] text-emerald-300">{stateHash ?? '—'}</dd>
            </div>
          </dl>
        )}

        {tab === 'resume' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-stone-500">lastSeq</span>
              <input
                type="number"
                value={resumeSeq}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-1"
                onChange={(e) => setResumeSeq(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="w-full rounded bg-sky-800 py-2 hover:bg-sky-700"
              onClick={() => {
                const gameId = view?.gameId;
                if (!gameId) return;
                import('../../lib/socket.js').then(({ getSocket }) => {
                  const socket = getSocket();
                  if (!socket) return;
                  socket.emit(
                    'session:resume',
                    { gameId, lastSeq: resumeSeq },
                    (res) => applyResume(res),
                  );
                });
              }}
            >
              session:resume 테스트
            </button>
          </div>
        )}

        {tab === 'spectator' && (
          <div>
            <p className="text-stone-500">관전 모드는 Dev 전용 raw SpectatorView입니다.</p>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-stone-900 p-2 text-[10px]">
              {spectatorView ? JSON.stringify(spectatorView, null, 2) : '플레이어 모드 (PlayerView 사용 중)'}
            </pre>
            {!spectatorView && view && (
              <p className="mt-2 text-emerald-600">게임 UI는 PlayerView만 렌더링합니다.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
