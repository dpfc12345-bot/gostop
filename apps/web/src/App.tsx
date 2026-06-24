import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSocketBinding } from './hooks/useSocketBinding.js';
import { LoginPage } from './pages/LoginPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { RoomPage } from './pages/RoomPage.js';
import { GamePage } from './pages/GamePage.js';
import { loadUser } from './lib/storage.js';
import { useGameStore } from './store/game-store.js';
import { useEffect } from 'react';

function AppRoutes() {
  const user = useGameStore((s) => s.user);
  const setUser = useGameStore((s) => s.setUser);

  useEffect(() => {
    if (!user) {
      const saved = loadUser();
      if (saved) setUser(saved);
    }
  }, [user, setUser]);

  useSocketBinding(user);

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/lobby" element={user ? <LobbyPage /> : <Navigate to="/" replace />} />
      <Route path="/room/:roomId" element={user ? <RoomPage /> : <Navigate to="/" replace />} />
      <Route path="/game/:roomId" element={user ? <GamePage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
