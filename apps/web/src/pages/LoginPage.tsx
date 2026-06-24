import { useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { defaultUserId, loadUser, saveUser } from '../lib/storage.js';
import { useGameStore } from '../store/game-store.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useGameStore((s) => s.setUser);
  const existing = loadUser();

  const [userId, setUserId] = useState(existing?.userId ?? defaultUserId());
  const [nickname, setNickname] = useState(existing?.nickname ?? '');

  function saveAndGo(path: string) {
    const user = { userId: userId.trim(), nickname: nickname.trim() || '플레이어' };
    saveUser(user);
    setUser(user);
    navigate(path);
  }

  function onLobby(e: FormEvent) {
    e.preventDefault();
    saveAndGo('/lobby');
  }

  function onSolo(e: FormEvent) {
    e.preventDefault();
    const user = { userId: userId.trim(), nickname: nickname.trim() || '플레이어' };
    saveUser(user);
    setUser(user);
    navigate(`/room/solo-${crypto.randomUUID().slice(0, 8)}`);
  }

  return (
    <AppShell centered>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-5xl text-gold">고스톱</h1>
          <p className="mt-2 text-sm text-stone-500">온라인 맞고 · 뉴맞고</p>
        </div>

        <form onSubmit={onLobby} className="glass-panel rounded-2xl p-6 sm:p-8">
          <Input label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="게임 닉네임" />
          <div className="mt-4">
            <Input label="ID" value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Button type="submit" variant="primary" size="lg" className="w-full font-display text-lg">
              시작하기
            </Button>
            <Button type="button" variant="gold" size="lg" className="w-full font-display text-lg" onClick={onSolo}>
              혼자하기 (AI)
            </Button>
          </div>
          {import.meta.env.DEV && (
            <p className="mt-4 text-center text-[10px] text-stone-600">개발 모드 · backend-api 미연동</p>
          )}
        </form>
      </div>
    </AppShell>
  );
}
