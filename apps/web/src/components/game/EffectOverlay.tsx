import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getCard } from '@gostop/engine';
import type { StateDiffMsg } from '@gostop/shared';
import { EFFECT_HOLD_MS } from '../../lib/motion-config.js';
import { useGameStore } from '../../store/game-store.js';
import { playSound } from '../../lib/sounds.js';

type EffectKind = 'bomb' | 'bright' | 'capture' | null;

/** Pop in, hold, then fade — stays readable on screen. */
const POP_HOLD_FADE = {
  duration: 1.75,
  times: [0, 0.12, 0.55, 1],
  ease: 'easeOut' as const,
};

function diffHasBrightCapture(msg: StateDiffMsg | undefined): boolean {
  for (const e of msg?.events ?? []) {
    if (e.type !== 'CardsCaptured') continue;
    if (e.cardIds.some((id) => getCard(id).category === 'BRIGHT')) return true;
  }
  return false;
}

export function EffectOverlay() {
  const eventLog = useGameStore((s) => s.eventLog);
  const [effect, setEffect] = useState<EffectKind>(null);
  const [shake, setShake] = useState(false);
  const lastId = useRef<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const last = eventLog[eventLog.length - 1];
    if (!last || last.id === lastId.current || last.kind !== 'DIFF') return;
    lastId.current = last.id;

    const msg = last.payload as StateDiffMsg | undefined;
    const types = (msg?.events ?? []).map((e) => e.type);

    let next: EffectKind = null;
    if (types.includes('BombDeclared')) {
      next = 'bomb';
      setShake(true);
      playSound('bomb');
      setTimeout(() => setShake(false), 900);
    } else if (types.includes('CardsCaptured')) {
      next = diffHasBrightCapture(msg) ? 'bright' : 'capture';
      playSound('capture');
    } else if (types.includes('GoSelected')) {
      playSound('go');
    } else if (types.includes('StopSelected')) {
      playSound('stop');
    }

    if (next) {
      setEffect(next);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setEffect(null), EFFECT_HOLD_MS);
    }

    return () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };
  }, [eventLog]);

  return (
    <>
      <AnimatePresence mode="wait">
        {effect === 'bomb' && (
          <motion.div
            key="bomb"
            className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <motion.span
              className="font-display text-5xl text-red-400 sm:text-6xl"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{
                scale: [0.2, 1.15, 1.15, 1.35],
                opacity: [0, 1, 1, 0],
              }}
              transition={POP_HOLD_FADE}
              style={{ textShadow: '0 0 48px rgba(196,30,58,0.85)' }}
            >
              폭탄!
            </motion.span>
          </motion.div>
        )}

        {effect === 'bright' && (
          <motion.div
            key="bright"
            className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <motion.span
              className="font-display text-5xl text-gold sm:text-6xl"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{
                scale: [0.3, 1.1, 1.1, 1.5],
                opacity: [0, 1, 1, 0],
              }}
              transition={POP_HOLD_FADE}
              style={{ textShadow: '0 0 40px rgba(245,200,66,0.8)' }}
            >
              광!
            </motion.span>
            <div className="absolute h-32 w-32 rounded-full border-4 border-amber-400/60 effect-burst-gold" />
          </motion.div>
        )}

        {effect === 'capture' && (
          <motion.div
            key="capture"
            className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <motion.span
              className="font-display text-3xl text-emerald-200 sm:text-4xl"
              initial={{ scale: 0.5, y: 24, opacity: 0 }}
              animate={{
                scale: [0.5, 1.08, 1.08, 1.15],
                y: [24, 0, 0, -28],
                opacity: [0, 1, 1, 0],
              }}
              transition={POP_HOLD_FADE}
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
            >
              먹었다!
            </motion.span>
            <div className="absolute h-24 w-24 rounded-full border-2 border-emerald-300/50 effect-capture-ring" />
          </motion.div>
        )}
      </AnimatePresence>
      {shake && <div className="pointer-events-none fixed inset-0 z-[54] screen-shake" />}
    </>
  );
}
