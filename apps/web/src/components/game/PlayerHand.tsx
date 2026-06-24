import { AnimatePresence, motion } from 'framer-motion';
import type { CardId } from '@gostop/engine';
import { cardHandTransition, cardLayoutTransition } from '../../lib/motion-config.js';
import { cardLayoutId } from '../../lib/card-layout-id.js';
import { HwatuCard, type HwatuCardSize } from './HwatuCard.js';

interface PlayerHandProps {
  cards: CardId[];
  selectable: boolean;
  onPlay?: (id: CardId) => void;
  size?: HwatuCardSize;
  /** Card currently in-flight toward the field — animate it out immediately. */
  playingCardId?: CardId | null;
}

export function PlayerHand({
  cards,
  selectable,
  onPlay,
  size = 'hand',
  playingCardId,
}: PlayerHandProps) {
  const overlap = cards.length > 9 ? 36 : cards.length > 6 ? 32 : 26;

  return (
    /* No LayoutGroup here — participates in the parent GameTable's "hwatu-cards" group
       so cards can share layout transitions with the field and captured piles. */
    <div className="hand-row hand-row-fan min-h-[7rem] px-0.5 py-1 sm:min-h-[8rem] sm:px-1 sm:py-2">
      <AnimatePresence mode="popLayout">
        {cards.map((id, i) => {
          const center = (cards.length - 1) / 2;
          const rotate = cards.length <= 1 ? 0 : (i - center) * 1.8;
          const isPlaying = id === playingCardId;

          return (
            <motion.div
              key={id}
              className="hand-card-wrap"
              layout
              layoutId={cardLayoutId(id)}
              initial={{ opacity: 0, y: 32, rotate: rotate + 8 }}
              animate={
                isPlaying
                  ? /* Fly the card toward the field (upward) immediately on click,
                       before the server responds. */
                    {
                      opacity: 0,
                      y: -140,
                      scale: 0.82,
                      rotate: 0,
                      zIndex: 60,
                      transition: { duration: 0.28, ease: [0.4, 0, 0.6, 1] },
                    }
                  : { opacity: 1, y: 0, rotate }
              }
              exit={
                isPlaying
                  ? { opacity: 0, scale: 0.8 }
                  : { opacity: 0, y: 16, scale: 0.85, rotate: rotate + 4 }
              }
              transition={{ ...cardHandTransition, ...cardLayoutTransition }}
              style={{
                zIndex: isPlaying ? 60 : selectable ? i + 10 : i,
                marginLeft: i > 0 ? -overlap : 0,
              }}
            >
              <HwatuCard
                id={id}
                size={size}
                selectable={selectable && !isPlaying}
                onClick={selectable && !isPlaying && onPlay ? () => onPlay(id) : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
