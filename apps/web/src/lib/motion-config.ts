/** Shared motion timings — slower so captures / effects read on mobile. */

export const EFFECT_HOLD_MS = 2400;

export const cardLayoutTransition = {
  layout: { duration: 0.65, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const cardEnterTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 26,
};

export const cardHandTransition = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
};
