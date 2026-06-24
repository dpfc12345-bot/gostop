import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerView } from '@gostop/engine';
import { Button } from '../ui/Button.js';

interface GoStopOverlayProps {
  view: PlayerView;
  onGo: () => void;
  onStop: () => void;
}

export function GoStopOverlay({ view, onGo, onStop }: GoStopOverlayProps) {
  const pending = view.pending;
  if (!pending || pending.kind !== 'GO_OR_STOP' || pending.seat !== view.self.seat) return null;
  if (!('currentScore' in pending)) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-[var(--color-gold)]/40 shadow-2xl"
          initial={{ scale: 0.7, y: 40, rotateX: 15 }}
          animate={{ scale: 1, y: 0, rotateX: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          style={{ boxShadow: 'var(--shadow-glow-gold)' }}
        >
          <div className="bg-gradient-to-b from-[#2a1810] to-[#151010] px-6 py-8 text-center">
            <motion.p
              className="font-display text-5xl text-gold"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              {pending.currentScore}점
            </motion.p>
            <h2 className="mt-2 font-display text-2xl tracking-wide text-white">고 · 스톱</h2>
            <p className="mt-2 text-sm text-stone-400">
              {view.self.goCount > 0
                ? `현재 ${view.self.goCount}고 — 더 올리시겠습니까?`
                : '승리 점수에 도달했습니다. 계속하시겠습니까?'}
            </p>

            <div className="mt-8 flex gap-3">
              <Button variant="gold" size="lg" className="flex-1 font-display text-lg" onClick={onGo}>
                고!
              </Button>
              <Button variant="stop" size="lg" className="flex-1 font-display text-lg" onClick={onStop}>
                스톱
              </Button>
            </div>
          </div>

          <motion.div
            className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl"
            animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
