import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import type { CardId } from '@gostop/engine';
import { cardHandTransition, cardLayoutTransition } from '../../lib/motion-config.js';
import { cardLayoutId } from '../../lib/card-layout-id.js';
import { HwatuCard, type HwatuCardSize } from './HwatuCard.js';

interface PlayerHandProps {
  cards: CardId[];
  selectable: boolean;
  onPlay?: (id: CardId) => void;
  size?: HwatuCardSize;
}

export function PlayerHand({ cards, selectable, onPlay, size = 'hand' }: PlayerHandProps) {
  const overlap = cards.length > 9 ? 36 : cards.length > 6 ? 32 : 26;

  return (
    <LayoutGroup id="player-hand">
      <div className="hand-row hand-row-fan min-h-[7rem] px-0.5 py-1 sm:min-h-[8rem] sm:px-1 sm:py-2">
        <AnimatePresence mode="popLayout">
          {cards.map((id, i) => {
            const center = (cards.length - 1) / 2;
            const rotate = cards.length <= 1 ? 0 : (i - center) * 1.8;
            return (
              <motion.div
                key={id}
                className="hand-card-wrap"
                layout
                layoutId={cardLayoutId(id)}
                initial={{ opacity: 0, y: 32, rotate: rotate + 8 }}
                animate={{ opacity: 1, y: 0, rotate }}
                exit={{ opacity: 0, y: 16, scale: 0.85, rotate: rotate + 4 }}
                transition={{ ...cardHandTransition, ...cardLayoutTransition }}
                style={{
                  zIndex: selectable ? i + 10 : i,
                  marginLeft: i > 0 ? -overlap : 0,
                }}
              >
                <HwatuCard
                  id={id}
                  size={size}
                  selectable={selectable}
                  onClick={selectable && onPlay ? () => onPlay(id) : undefined}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
