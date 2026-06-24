import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.js';
import { Button } from '../components/ui/Button.js';
import { useGameStore } from '../store/game-store.js';

export function LobbyPage() {
  const navigate = useNavigate();
  const user = useGameStore((s) => s.user);
  const socketStatus = useGameStore((s) => s.socketStatus);

  function createRoom() {
    navigate(`/room/room-${crypto.randomUUID().slice(0, 8)}`);
  }

  function startSolo() {
    navigate(`/room/solo-${crypto.randomUUID().slice(0, 8)}`);
  }

  function joinExisting() {
    const id = prompt('방 코드 입력');
    if (id?.trim()) navigate(`/room/${id.trim()}`);
  }

  if (!user) {
    navigate('/');
    return null;
  }

  const connected = socketStatus === 'connected';

  return (
    <AppShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 py-6">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-white">로비</h1>
          <p className="mt-1 text-stone-400">
            {user.nickname}
            <span
              className={`ml-2 inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-500'}`}
            />
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-3">
          <Button variant="gold" size="lg" className="w-full py-5 font-display text-xl" onClick={startSolo}>
            혼자하기 (AI)
          </Button>
          <Button variant="primary" size="lg" className="w-full py-5 font-display text-xl" onClick={createRoom}>
            빠른 매칭
          </Button>
          <Button variant="outline" size="lg" className="w-full py-4" onClick={joinExisting}>
            방 코드로 입장
          </Button>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-stone-600">
          혼자하기는 AI와 즉시 대국합니다.
          <br />
          빠른 매칭은 친구와 같은 방에서 2인 대전합니다.
        </p>
      </div>
    </AppShell>
  );
}
