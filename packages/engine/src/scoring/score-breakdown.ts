/**
 * ScoreBreakdown — the AUTHORITATIVE, fully-explained result of scoring a hand.
 *
 * This is the single source of truth for a score: `total` is the final number,
 * and every component, additive bonus and multiplier that produced it is listed
 * so the result screen and the admin replay viewer can show exactly WHY a player
 * scored what they did (광 3장, 고도리, 7고, 흔들기 ×2, 피박 ×2 …).
 *
 * The ScoreCalculator (step 7) fills this in; step 6 only ships the shape and a
 * zeroed stub, and records the special-rule facts (흔들기/폭탄/멍따/쇼당) that
 * step 7 will turn into multipliers.
 */
import type { CardId } from '../domain/card/card.js';
import type { BakKind } from '../rules/rule-config.js';
import type { Seat } from '../state/game-state.js';

/** One additive scoring component (a category total). */
export interface ScoreComponent {
  /** Stable code for client i18n, e.g. 'GWANG_3', 'GODORI', 'PI', 'HONGDAN'. */
  code: string;
  /** Human-readable Korean label for quick display, e.g. '삼광', '고도리'. */
  label: string;
  /** Base points this component contributes. */
  points: number;
  /** Cards that justify this component (for replay highlighting). */
  cards?: CardId[];
}

/** One multiplicative factor applied to the running score. */
export interface ScoreMultiplier {
  /** 'GO' | 'SHAKE' | 'BOMB' | 'PI_BAK' | 'GWANG_BAK' | 'GO_BAK' | 'MUNGTTA' | 'SHOWDOWN' … */
  code: string;
  label: string;
  /** Multiplicative factor (×2 → 2). */
  factor: number;
}

export interface ScoreBreakdown {
  seat: Seat;
  /** Sum of `components[].points` before bonuses/multipliers. */
  base: number;
  components: ScoreComponent[];
  /** Additive 고 bonus (added to base before multipliers). */
  goBonus: number;
  /** Every multiplier applied, in order, for full transparency. */
  multipliers: ScoreMultiplier[];
  /** Product of all `multipliers[].factor` (1 when none). */
  multiplier: number;
  /** Final, authoritative score after bonus and all multipliers. */
  total: number;

  // ── Recorded special-rule facts (step 6) → step 7 turns these into factors ──
  appliedBak: BakKind[];
  shaking: boolean;
  shakeCount: number;
  bomb: boolean;
  bombCount: number;
  /** 멍따 achieved (열끗 ≥ threshold). Effect applied in step 7. */
  mungtta: boolean;
  /** Number of 쇼당 occurrences observed. Effect applied in step 7. */
  showdownCount: number;
}

/** A zeroed breakdown — the step-6 stub and a safe default. */
export function emptyBreakdown(seat: Seat): ScoreBreakdown {
  return {
    seat,
    base: 0,
    components: [],
    goBonus: 0,
    multipliers: [],
    multiplier: 1,
    total: 0,
    appliedBak: [],
    shaking: false,
    shakeCount: 0,
    bomb: false,
    bombCount: 0,
    mungtta: false,
    showdownCount: 0,
  };
}
