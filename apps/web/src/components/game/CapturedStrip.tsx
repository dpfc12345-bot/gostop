import type { CapturedPile, RulePreset, Seat } from '@gostop/engine';
import { AnimatePresence, motion } from 'framer-motion';
import { cardEnterTransition, cardLayoutTransition } from '../../lib/motion-config.js';
import { cardLayoutId } from '../../lib/card-layout-id.js';
import { HwatuCard } from './HwatuCard.js';

interface CapturedStripProps {
  rulePreset: RulePreset;
  seat: Seat;
  captured: CapturedPile;
  goCount: number;
  hasShaken: boolean;
  compact?: boolean;
}

const SECTIONS = [
  { key: 'brights' as const, title: '광', cls: 'pile-section-bright text-amber-400' },
  { key: 'animals' as const, title: '열끗', cls: 'pile-section-animal text-orange-300' },
  { key: 'ribbons' as const, title: '띠', cls: 'pile-section-ribbon text-rose-300' },
  { key: 'junk' as const, title: '피', cls: 'pile-section-junk text-stone-400' },
];

export function CapturedStrip({
  captured,
  compact: _compact,
}: CapturedStripProps) {
  /* No LayoutGroup here — participates in the parent GameTable's "hwatu-cards" group
     so captured cards animate in from the field via shared layoutId transitions. */
  return (
    <div className="grid grid-cols-4 gap-1">
      {SECTIONS.map(({ key, title, cls }) => {
        const cards = captured[key];
        return (
          <div key={key} className={`pile-section ${cls}`}>
            <div className="mb-0.5 flex justify-between text-[8px] font-extrabold uppercase tracking-wide opacity-75 sm:text-[9px]">
              <span>{title}</span>
              <span>{cards.length}</span>
            </div>
            <div className="flex min-h-[1.75rem] flex-wrap gap-px sm:min-h-[2rem] sm:gap-0.5">
              <AnimatePresence mode="popLayout">
                {cards.length === 0 ? (
                  <span className="py-0.5 text-[7px] opacity-30 sm:text-[8px]">—</span>
                ) : (
                  cards.map((id, i) => (
                    <motion.div
                      key={id}
                      layout
                      layoutId={cardLayoutId(id)}
                      /* Captured cards fly in from the field (above) */
                      initial={{ scale: 0.6, opacity: 0, y: -24 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ ...cardEnterTransition, ...cardLayoutTransition }}
                      style={{ zIndex: i }}
                    >
                      <HwatuCard id={id} size="xs" inJunkPile={key === 'junk'} />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
