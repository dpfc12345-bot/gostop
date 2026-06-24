/**
 * Built-in rule presets and the resolver used to materialise a RuleConfig.
 *
 * Switching the entire ruleset is a one-liner:
 *   const rule = resolveRuleConfig('PMANG_NEWMATGO');
 *   const rule = resolveRuleConfig('CUSTOM', { go: { multiplierFromGo: 2 } });
 *
 * The resolved config is then stored in GameState for self-contained replay.
 */
import type { DeepPartial, RuleConfig, RulePreset } from './rule-config.js';

/** 피망 뉴맞고 — the default. 2-player (맞고), modern special rules on. */
export const PMANG_NEWMATGO: RuleConfig = {
  preset: 'PMANG_NEWMATGO',
  deal: { playerCount: 2, handSize: 10, fieldSize: 8 },
  scoring: {
    bright: { threeWithoutRain: 3, threeWithRain: 2, four: 4, five: 15 },
    godori: 5,
    hongdan: 3,
    cheongdan: 3,
    chodan: 3,
    animalStartCount: 5,
    animalStartScore: 1,
    animalPerExtra: 1,
    ribbonStartCount: 5,
    ribbonStartScore: 1,
    ribbonPerExtra: 1,
    junkStartCount: 10,
    junkStartScore: 1,
    junkPerExtra: 1,
    ssangpiValue: 2,
    kukjin: 'PLAYER_CHOICE',
    mungDdaAnimalCount: 7,
    mungDdaBonus: 0,
  },
  go: {
    minScoreToFinish: 7,
    bonusPerGo: [1, 1],
    bonusBeyond: 1,
    multiplierFromGo: 3,
    multiplierPerStep: 2,
    maxGo: 0,
  },
  bak: {
    gwangBak: true,
    piBak: true,
    piBakThreshold: 7,
    goBak: true,
    mengBak: false,
    multiplier: 2,
    stackable: true,
  },
  special: {
    shaking: { enabled: true, scoreMultiplier: 2 },
    bomb: { enabled: true, scoreMultiplier: 2 },
    ttakDak: { enabled: true },
    jjok: { enabled: true },
    ssakSseuli: { enabled: true },
    ppeok: { enabled: true },
    nagari: { enabled: true, carryStakeMultiplier: 2 },
    chongtong: { enabled: true, score: 7 },
    showdown: { enabled: true, scoreMultiplier: 2 },
  },
};

/** 한게임 고스톱 — 2-player variant; 국진 fixed as double junk, 멍박 on. */
export const HANGAME_GOSTOP: RuleConfig = {
  preset: 'HANGAME_GOSTOP',
  deal: { playerCount: 2, handSize: 10, fieldSize: 8 },
  scoring: {
    bright: { threeWithoutRain: 3, threeWithRain: 3, four: 4, five: 15 },
    godori: 5,
    hongdan: 3,
    cheongdan: 3,
    chodan: 3,
    animalStartCount: 5,
    animalStartScore: 1,
    animalPerExtra: 1,
    ribbonStartCount: 5,
    ribbonStartScore: 1,
    ribbonPerExtra: 1,
    junkStartCount: 10,
    junkStartScore: 1,
    junkPerExtra: 1,
    ssangpiValue: 2,
    kukjin: 'ALWAYS_DOUBLE_JUNK',
    mungDdaAnimalCount: 7,
    mungDdaBonus: 0,
  },
  go: {
    minScoreToFinish: 7,
    bonusPerGo: [1, 1],
    bonusBeyond: 1,
    multiplierFromGo: 3,
    multiplierPerStep: 2,
    maxGo: 0,
  },
  bak: {
    gwangBak: true,
    piBak: true,
    piBakThreshold: 10,
    goBak: true,
    mengBak: true,
    multiplier: 2,
    stackable: true,
  },
  special: {
    shaking: { enabled: true, scoreMultiplier: 2 },
    bomb: { enabled: true, scoreMultiplier: 2 },
    ttakDak: { enabled: true },
    jjok: { enabled: true },
    ssakSseuli: { enabled: true },
    ppeok: { enabled: true },
    nagari: { enabled: true, carryStakeMultiplier: 2 },
    chongtong: { enabled: true, score: 7 },
    showdown: { enabled: true, scoreMultiplier: 2 },
  },
};

/** Classic 3-player 고스톱 — 3점 나기, fewer modern specials. */
export const CLASSIC_GOSTOP: RuleConfig = {
  preset: 'CLASSIC_GOSTOP',
  deal: { playerCount: 3, handSize: 7, fieldSize: 6 },
  scoring: {
    bright: { threeWithoutRain: 3, threeWithRain: 2, four: 4, five: 15 },
    godori: 5,
    hongdan: 3,
    cheongdan: 3,
    chodan: 3,
    animalStartCount: 5,
    animalStartScore: 1,
    animalPerExtra: 1,
    ribbonStartCount: 5,
    ribbonStartScore: 1,
    ribbonPerExtra: 1,
    junkStartCount: 10,
    junkStartScore: 1,
    junkPerExtra: 1,
    ssangpiValue: 2,
    kukjin: 'ALWAYS_ANIMAL',
    mungDdaAnimalCount: 0,
    mungDdaBonus: 0,
  },
  go: {
    minScoreToFinish: 3,
    bonusPerGo: [1, 1],
    bonusBeyond: 1,
    multiplierFromGo: 3,
    multiplierPerStep: 2,
    maxGo: 0,
  },
  bak: {
    gwangBak: true,
    piBak: true,
    piBakThreshold: 7,
    goBak: true,
    mengBak: false,
    multiplier: 2,
    stackable: false,
  },
  special: {
    shaking: { enabled: false, scoreMultiplier: 2 },
    bomb: { enabled: false, scoreMultiplier: 2 },
    ttakDak: { enabled: true },
    jjok: { enabled: true },
    ssakSseuli: { enabled: true },
    ppeok: { enabled: true },
    nagari: { enabled: false, carryStakeMultiplier: 2 },
    chongtong: { enabled: true, score: 3 },
    showdown: { enabled: true, scoreMultiplier: 2 },
  },
};

const BUILT_IN_PRESETS: Record<Exclude<RulePreset, 'CUSTOM'>, RuleConfig> = {
  PMANG_NEWMATGO,
  HANGAME_GOSTOP,
  CLASSIC_GOSTOP,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = deepClone(item);
    }
    return out as T;
  }
  return value;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = base[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result;
}

/**
 * Resolve a preset into a concrete, deeply-cloned RuleConfig, applying optional
 * overrides. CUSTOM is based on PMANG_NEWMATGO. The returned `preset` always
 * reflects the requested preset.
 */
export function resolveRuleConfig(
  preset: RulePreset,
  overrides?: DeepPartial<RuleConfig>,
): RuleConfig {
  const source = preset === 'CUSTOM' ? PMANG_NEWMATGO : BUILT_IN_PRESETS[preset];
  const base = deepClone(source) as unknown as Record<string, unknown>;
  const merged = overrides ? deepMerge(base, overrides as Record<string, unknown>) : base;
  return { ...(merged as unknown as RuleConfig), preset };
}
