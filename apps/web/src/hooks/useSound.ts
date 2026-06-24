import { useCallback, useEffect, useState } from 'react';
import { isSoundMuted, playSound, setSoundMuted, type SoundId } from '../lib/sounds.js';

export function useSound() {
  const [muted, setMuted] = useState(isSoundMuted());

  useEffect(() => {
    setSoundMuted(muted);
  }, [muted]);

  const play = useCallback((id: SoundId) => playSound(id), []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}

export type { SoundId };
