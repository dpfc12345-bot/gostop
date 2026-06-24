import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { CardId } from '@gostop/engine';
import { cardEnterTransition } from '../../lib/motion-config.js';
import { getCardArt } from '../../lib/card-art.js';
import { cardImageUrl } from '../../lib/card-sprites.js';

export type HwatuCardSize = 'xs' | 'sm' | 'md' | 'lg' | 'hand';

interface HwatuCardProps {
  id: CardId;
  size?: HwatuCardSize;
  selectable?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  layoutId?: string;
  /** 피 더미에 놓인 국진 등 — 쌍피(双) 배지와 구분 */
  inJunkPile?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

/** ~5:7 hwatu ratio — sized up for mobile-first play */
const sizes: Record<HwatuCardSize, string> = {
  xs: 'h-[4.25rem] w-[3.05rem] sm:h-[4.5rem] sm:w-[3.2rem]',
  sm: 'h-[5.25rem] w-[3.75rem] sm:h-[5.75rem] sm:w-[4.1rem]',
  md: 'h-[6.5rem] w-[4.65rem] sm:h-[7rem] sm:w-[5rem]',
  lg: 'h-[8rem] w-[5.7rem]',
  hand: 'h-[6.5rem] w-[4.65rem] sm:h-[7.5rem] sm:w-[5.35rem]',
};

const springIn = {
  initial: { opacity: 0, y: 10, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.88, y: 6 },
  transition: cardEnterTransition,
};

export function HwatuCard({
  id,
  size = 'md',
  selectable,
  selected,
  faceDown = false,
  layoutId,
  inJunkPile = false,
  onClick,
  style,
  className = '',
}: HwatuCardProps) {
  const sizeCls = sizes[size];
  const interactive = Boolean(selectable || onClick);

  if (faceDown) {
    return (
      <motion.div
        layoutId={layoutId}
        style={style}
        className={`hwatu-card hwatu-back ${sizeCls} ${className}`}
        whileHover={interactive ? { y: -4, scale: 1.03 } : undefined}
      />
    );
  }

  const art = getCardArt(id, { inJunkPile });

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      style={style}
      disabled={!interactive}
      onClick={onClick}
      {...springIn}
      whileHover={
        interactive
          ? { y: -10, scale: 1.06, zIndex: 20, boxShadow: 'var(--shadow-card-lift), 0 0 0 2px var(--color-gold)' }
          : undefined
      }
      whileTap={interactive ? { scale: 0.96, y: -4 } : undefined}
      className={[
        'hwatu-card hwatu-face',
        sizeCls,
        art.isSpecial ? 'hwatu-special' : '',
        selectable ? 'hwatu-selectable' : '',
        selected ? 'hwatu-selected' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={`${art.monthLabel} ${art.categoryLabel}`}
    >
      <img
        src={cardImageUrl(id)}
        alt={`${art.monthLabel} ${art.categoryLabel}`}
        className="hwatu-card-img"
        draggable={false}
        loading="lazy"
      />
      {art.badge && !art.pattern.includes('bright') && (
        <span className={`hwatu-badge-overlay ${art.isSsangPi ? 'hwatu-badge-ssangpi' : ''}`}>
          {art.badge}
        </span>
      )}
    </motion.button>
  );
}
