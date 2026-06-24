/**
 * ScoreEngine — turns a player's captured pile + the RuleConfig into a fully
 * explained ScoreBreakdown (the SOURCE OF TRUTH for a score).
 *
 * Versioning: every game records the `scoreEngineVersion` it was played under
 * (see GameState). Scoring always dispatches through `scoreEngineFor(version)`,
 * so a recorded game replays with its ORIGINAL scoring logic even after newer
 * versions ship or presets change. Bump SCORE_ENGINE_VERSION and register a new
 * implementation when scoring rules change; never edit a frozen version.
 *
 * The engine reads ONLY the RuleConfig — no hard-coded numbers — so 피망/한게임/
 * custom rules all flow through the same code.
 *
 * Two entry points:
 *   - evaluate(state, seat): a player's OWN score, used for the 고/스톱 gate.
 *     박 is NOT included (박 depends on the opponent and only settles a win).
 *   - settle(state, winner): the winner's final breakdown INCLUDING 박.
 */
import { getCard } from '../domain/card/deck.js';
import { junkValueOf } from '../domain/card/card.js';
import type { BakKind, RuleConfig } from '../rules/rule-config.js';
import type { CapturedPile, GameState, PlayerState, Seat } from '../state/game-state.js';
import {
  emptyBreakdown,
  type ScoreBreakdown,
  type ScoreComponent,
  type ScoreMultiplier,
} from './score-breakdown.js';

export const SCORE_ENGINE_VERSION = 1;

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreCalculator {
  /** A player's own score (고/스톱 gate). Excludes 박. */
  evaluate(state: GameState, seat: Seat): ScoreResult;
  /** The winner's final breakdown including 박 against the opponent(s). */
  settle(state: GameState, winner: Seat): ScoreBreakdown;
}

export interface ScoreEngine extends ScoreCalculator {
  version: number;
}

const BAK_LABEL: Record<BakKind, string> = {
  GWANG_BAK: '광박',
  PI_BAK: '피박',
  GO_BAK: '고박',
  MENG_BAK: '멍박',
};

/** Total 피-points in a captured pile, honouring the 국진 mode for the owner. */
function junkPointsOf(pile: CapturedPile, rule: RuleConfig): number {
  let points = 0;
  for (const id of pile.junk) {
    const card = getCard(id);
    if (card.isKukjin === true) {
      points += rule.scoring.ssangpiValue;
    } else {
      points += junkValueOf(card);
    }
  }
  if (rule.scoring.kukjin === 'ALWAYS_DOUBLE_JUNK') {
    if (pile.animals.some((id) => getCard(id).isKukjin)) points += rule.scoring.ssangpiValue;
  }
  return points;
}

/** Compute the additive scoring components (광/열끗/고도리/멍따/띠/단/피). */
function computeComponents(
  pile: CapturedPile,
  rule: RuleConfig,
): { components: ScoreComponent[]; mungtta: boolean } {
  const s = rule.scoring;
  const components: ScoreComponent[] = [];

  // 광
  const brights = pile.brights;
  const hasRain = brights.some((id) => getCard(id).isRainBright === true);
  if (brights.length >= 5) {
    components.push({ code: 'GWANG_5', label: '오광', points: s.bright.five, cards: [...brights] });
  } else if (brights.length === 4) {
    components.push({ code: 'GWANG_4', label: '사광', points: s.bright.four, cards: [...brights] });
  } else if (brights.length === 3) {
    components.push(
      hasRain
        ? { code: 'GWANG_3_BI', label: '비삼광', points: s.bright.threeWithRain, cards: [...brights] }
        : { code: 'GWANG_3', label: '삼광', points: s.bright.threeWithoutRain, cards: [...brights] },
    );
  }

  // 열끗 (국진 reassigned to 피 when the mode says so)
  const kukjinAsJunk =
    s.kukjin === 'ALWAYS_DOUBLE_JUNK' && pile.animals.some((id) => getCard(id).isKukjin);
  const animals = kukjinAsJunk
    ? pile.animals.filter((id) => getCard(id).isKukjin !== true)
    : pile.animals;

  if (animals.length >= s.animalStartCount) {
    const points = s.animalStartScore + (animals.length - s.animalStartCount) * s.animalPerExtra;
    components.push({ code: 'YEOLKKUT', label: '열끗', points, cards: [...animals] });
  }

  // 고도리 (3 birds)
  const godori = animals.filter((id) => getCard(id).isGodori === true);
  if (godori.length >= 3) {
    components.push({ code: 'GODORI', label: '고도리', points: s.godori, cards: godori });
  }

  // 멍따
  let mungtta = false;
  if (s.mungDdaAnimalCount > 0 && animals.length >= s.mungDdaAnimalCount) {
    mungtta = true;
    if (s.mungDdaBonus > 0) {
      components.push({ code: 'MUNGTTA', label: '멍따', points: s.mungDdaBonus, cards: [...animals] });
    }
  }

  // 띠 (count) + 단 (sets)
  const ribbons = pile.ribbons;
  if (ribbons.length >= s.ribbonStartCount) {
    const points = s.ribbonStartScore + (ribbons.length - s.ribbonStartCount) * s.ribbonPerExtra;
    components.push({ code: 'TTI', label: '띠', points, cards: [...ribbons] });
  }
  const hongdan = ribbons.filter((id) => getCard(id).ribbon === 'HONGDAN');
  if (hongdan.length >= 3) {
    components.push({ code: 'HONGDAN', label: '홍단', points: s.hongdan, cards: hongdan });
  }
  const cheongdan = ribbons.filter((id) => getCard(id).ribbon === 'CHEONGDAN');
  if (cheongdan.length >= 3) {
    components.push({ code: 'CHEONGDAN', label: '청단', points: s.cheongdan, cards: cheongdan });
  }
  const chodan = ribbons.filter((id) => getCard(id).ribbon === 'CHODAN');
  if (chodan.length >= 3) {
    components.push({ code: 'CHODAN', label: '초단', points: s.chodan, cards: chodan });
  }

  // 피
  const junkPoints = junkPointsOf(pile, rule);
  if (junkPoints >= s.junkStartCount) {
    const points = s.junkStartScore + (junkPoints - s.junkStartCount) * s.junkPerExtra;
    components.push({ code: 'PI', label: '피', points, cards: [...pile.junk] });
  }

  return { components, mungtta };
}

/** Additive 고 bonus + the 고 multiplier (if the go count crosses the threshold). */
function goContribution(
  goCount: number,
  rule: RuleConfig,
): { goBonus: number; multiplier: ScoreMultiplier | null } {
  if (goCount <= 0) return { goBonus: 0, multiplier: null };
  let goBonus = 0;
  for (let i = 0; i < goCount; i++) {
    goBonus += i < rule.go.bonusPerGo.length ? rule.go.bonusPerGo[i]! : rule.go.bonusBeyond;
  }
  let multiplier: ScoreMultiplier | null = null;
  if (rule.go.multiplierFromGo > 0 && goCount >= rule.go.multiplierFromGo) {
    const steps = goCount - rule.go.multiplierFromGo + 1;
    const factor = Math.pow(rule.go.multiplierPerStep, steps);
    multiplier = { code: 'GO_MULT', label: `${goCount}고`, factor };
  }
  return { goBonus, multiplier };
}

function buildBreakdown(state: GameState, seat: Seat): ScoreBreakdown {
  const rule = state.rule;
  const player = state.players.find((p) => p.seat === seat);
  if (!player) return emptyBreakdown(seat);

  const { components, mungtta } = computeComponents(player.captured, rule);
  const base = components.reduce((sum, c) => sum + c.points, 0);

  const { goBonus, multiplier: goMult } = goContribution(player.goCount, rule);

  const multipliers: ScoreMultiplier[] = [];
  if (goMult) multipliers.push(goMult);
  if (rule.special.shaking.enabled && player.hasShaken) {
    multipliers.push({ code: 'SHAKE', label: '흔들기', factor: rule.special.shaking.scoreMultiplier });
  }
  if (rule.special.bomb.enabled && player.bombCount > 0) {
    multipliers.push({
      code: 'BOMB',
      label: '폭탄',
      factor: Math.pow(rule.special.bomb.scoreMultiplier, player.bombCount),
    });
  }
  if (rule.special.showdown.enabled && player.showdownCount > 0) {
    multipliers.push({
      code: 'SHOWDOWN',
      label: '쇼당',
      factor: Math.pow(rule.special.showdown.scoreMultiplier, player.showdownCount),
    });
  }

  const multiplier = multipliers.reduce((m, x) => m * x.factor, 1);
  const total = (base + goBonus) * multiplier;

  return {
    seat,
    base,
    components,
    goBonus,
    multipliers,
    multiplier,
    total,
    appliedBak: [],
    shaking: player.hasShaken,
    shakeCount: player.shakenMonths.length,
    bomb: player.bombCount > 0,
    bombCount: player.bombCount,
    mungtta,
    showdownCount: player.showdownCount,
  };
}

function evaluateV1(state: GameState, seat: Seat): ScoreResult {
  const breakdown = buildBreakdown(state, seat);
  return { total: breakdown.total, breakdown };
}

/** Determine which 박 apply to a single opponent of the winner. */
function detectBak(
  winnerBreakdown: ScoreBreakdown,
  loser: PlayerState,
  rule: RuleConfig,
): BakKind[] {
  const bak: BakKind[] = [];
  const cfg = rule.bak;

  const winnerWonOnGwang = winnerBreakdown.components.some((c) => c.code.startsWith('GWANG'));
  if (cfg.gwangBak && winnerWonOnGwang && loser.captured.brights.length === 0) {
    bak.push('GWANG_BAK');
  }
  if (cfg.piBak && junkPointsOf(loser.captured, rule) < cfg.piBakThreshold) {
    bak.push('PI_BAK');
  }
  if (cfg.goBak && loser.goCount > 0) {
    bak.push('GO_BAK');
  }
  if (cfg.mengBak && loser.captured.animals.length === 0) {
    bak.push('MENG_BAK');
  }
  return bak;
}

function settleV1(state: GameState, winner: Seat): ScoreBreakdown {
  const rule = state.rule;
  const base = buildBreakdown(state, winner);
  const losers = state.players.filter((p) => p.seat !== winner);
  if (losers.length === 0) return base;

  // 2-player 맞고 is the supported settlement path; for >2 players we apply 박
  // against the first opponent (full multi-loser settlement lands with 3-player).
  const loser = losers[0]!;
  const appliedBak = detectBak(base, loser, rule);

  const multipliers = [...base.multipliers];
  if (appliedBak.length > 0) {
    if (rule.bak.stackable) {
      for (const kind of appliedBak) {
        multipliers.push({ code: kind, label: BAK_LABEL[kind], factor: rule.bak.multiplier });
      }
    } else {
      multipliers.push({ code: 'BAK', label: '박', factor: rule.bak.multiplier });
    }
  }

  const multiplier = multipliers.reduce((m, x) => m * x.factor, 1);
  const total = (base.base + base.goBonus) * multiplier;

  return { ...base, multipliers, multiplier, total, appliedBak };
}

const ENGINE_V1: ScoreEngine = { version: 1, evaluate: evaluateV1, settle: settleV1 };

const REGISTRY: Readonly<Record<number, ScoreEngine>> = { 1: ENGINE_V1 };

/** Look up the scoring implementation for a recorded version. Throws if unknown. */
export function scoreEngineFor(version: number): ScoreEngine {
  const engine = REGISTRY[version];
  if (!engine) throw new Error(`unknown ScoreEngine version: ${version}`);
  return engine;
}

/**
 * The default score dependency: dispatches to the engine version recorded on the
 * game state, guaranteeing version-faithful replay.
 */
export const versionedScoreCalculator: ScoreCalculator = {
  evaluate: (state, seat) => scoreEngineFor(state.scoreEngineVersion).evaluate(state, seat),
  settle: (state, winner) => scoreEngineFor(state.scoreEngineVersion).settle(state, winner),
};

/** A no-op calculator (always 0) for tests that want scoring disabled. */
export const stubScoreCalculator: ScoreCalculator = {
  evaluate: (_state, seat) => ({ total: 0, breakdown: emptyBreakdown(seat) }),
  settle: (_state, winner) => emptyBreakdown(winner),
};
