import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerView } from '@gostop/engine';
import { Button } from '../ui/Button.js';
import { HwatuCard } from './HwatuCard.js';

interface KukjinOverlayProps {
  view: PlayerView;
  onChoose: (asDoubleJunk: boolean) => void;
}

/** 국진(9월) — 열끗 vs 쌍피(2점) 선택 */
export function KukjinOverlay({ view, onChoose }: KukjinOverlayProps) {
  const pending = view.pending;
  if (!pending || pending.kind !== 'CHOOSE_KUKJIN' || pending.seat !== view.self.seat) return null;
  if (!('cardId' in pending)) return null;

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
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-emerald-400/35 shadow-2xl"
          initial={{ scale: 0.7, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        >
          <div className="bg-gradient-to-b from-[#102820] to-[#0a1410] px-6 py-8 text-center">
            <h2 className="font-display text-2xl tracking-wide text-white">국진 선택</h2>
            <p className="mt-2 text-sm text-stone-400">
              9월 국진 — 열끗으로 쓸지, 피 2점으로 쓸지 고르세요.
              <br />
              <span className="text-[11px] text-stone-500">(11월 빨간 피가 진짜 쌍피입니다)</span>
            </p>

            <div className="mx-auto mt-5 flex justify-center">
              <HwatuCard id={pending.cardId} size="lg" />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="gold"
                size="lg"
                className="flex-1 font-display text-lg"
                onClick={() => onChoose(false)}
              >
                열끗
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1 font-display text-lg"
                onClick={() => onChoose(true)}
              >
                피 (2점)
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
