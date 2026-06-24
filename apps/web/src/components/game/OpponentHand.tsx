import { AnimatePresence, motion } from 'framer-motion';
import { HwatuCard } from './HwatuCard.js';

interface OpponentHandProps {
  count: number;
}

/** Face-down fan showing hand size only — opponent cards are hidden by engine. */
export function OpponentHand({ count }: OpponentHandProps) {
  if (count === 0) return null;

  const displayCount = Math.min(count, 10);
  const overlap = displayCount > 8 ? 22 : displayCount > 5 ? 20 : 18;

  return (
    <div className="flex items-end justify-center py-1" aria-label={`상대 패 ${count}장`}>
      <AnimatePresence mode="popLayout">
        {Array.from({ length: displayCount }, (_, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              zIndex: i,
              marginLeft: i > 0 ? -overlap : 0,
              transform: `rotate(${(i - (displayCount - 1) / 2) * 1.2}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            <HwatuCard
              id={0}
              faceDown
              size="sm"
              layoutId={`opp-back-${i}`}
              className="pointer-events-none scale-100 sm:scale-100"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
