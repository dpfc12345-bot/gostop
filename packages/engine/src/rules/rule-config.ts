/**
 * RuleConfig — the single data structure that parameterises ALL scoring and
 * special rules. The RuleEngine (step 6) and ScoreCalculator (step 7) only
 * READ this; they contain no hard-coded numbers. Swapping the preset (or
 * overriding fields) is the only thing needed to switch between 피망 뉴맞고,
 * 한게임 고스톱, classic rules, or a fully custom ruleset.
 *
 * A resolved RuleConfig is stored inside GameState, so a recorded game replays
 * under the exact rules it was played with — even if presets change later.
 */

export type RulePreset = 'PMANG_NEWMATGO' | 'HANGAME_GOSTOP' | 'CLASSIC_GOSTOP' | 'CUSTOM';

/** How the 국진 (month-9 animal) may be used. */
export type KukjinMode =
  | 'ALWAYS_DOUBLE_JUNK' // 항상 쌍피
  | 'ALWAYS_ANIMAL' // 항상 열끗
  | 'PLAYER_CHOICE'; // 플레이어가 선택 (capture 시점)

export interface DealConfig {
  /** 2 = 맞고, 3 = 3인 고스톱. */
  playerCount: 2 | 3;
  /** Cards dealt to each player's hand. */
  handSize: number;
  /** Cards placed face-up on the field at the start. */
  fieldSize: number;
}

/** 광 (bright) scoring. */
export interface BrightScoring {
  /** 3광 without the rain bright (비광 미포함). */
  threeWithoutRain: number;
  /** 3광 including the rain bright (비광 포함). Usually lower. */
  threeWithRain: number;
  /** 4광. */
  four: number;
  /** 5광. */
  five: number;
}

export interface ScoringConfig {
  bright: BrightScoring;
  /** 고도리 (3 birds). */
  godori: number;
  /** 홍단. */
  hongdan: number;
  /** 청단. */
  cheongdan: number;
  /** 초단. */
  chodan: number;
  /** 열끗: scoring starts at `animalStartCount` cards = `animalStartScore`. */
  animalStartCount: number;
  animalStartScore: number;
  animalPerExtra: number;
  /** 띠: scoring starts at `ribbonStartCount` ribbons = `ribbonStartScore`. */
  ribbonStartCount: number;
  ribbonStartScore: number;
  ribbonPerExtra: number;
  /** 피: scoring starts at `junkStartCount` junk-points = `junkStartScore`. */
  junkStartCount: number;
  junkStartScore: number;
  junkPerExtra: number;
  /** 쌍피 worth in junk-points. */
  ssangpiValue: number;
  kukjin: KukjinMode;
  /** 멍따 — bonus when collecting many 열끗 (e.g. 7). 0 disables. */
  mungDdaAnimalCount: number;
  mungDdaBonus: number;
}

export interface GoConfig {
  /** Minimum score required to be allowed to 고/스톱 (날 수 있는 최소 점수). */
  minScoreToFinish: number;
  /** Additive bonus per 고 declaration, indexed by go number (1-based via [0]=1고). */
  bonusPerGo: readonly number[];
  /** Flat additive bonus for go numbers beyond `bonusPerGo` length. */
  bonusBeyond: number;
  /** From this 고 count onward the running score is multiplied. 0 disables. */
  multiplierFromGo: number;
  /** Multiplier factor applied per qualifying go step (e.g. 2 → ×2, ×4, ...). */
  multiplierPerStep: number;
  /** Hard cap on number of 고 (0 = unlimited). */
  maxGo: number;
}

export type BakKind = 'GWANG_BAK' | 'PI_BAK' | 'GO_BAK' | 'MENG_BAK';

export interface BakConfig {
  /** 광박: loser took 0 brights while winner won on 광. */
  gwangBak: boolean;
  /** 피박: loser holds fewer than `piBakThreshold` junk-points. */
  piBak: boolean;
  piBakThreshold: number;
  /** 고박: a player who declared 고 ends up losing. */
  goBak: boolean;
  /** 멍박: loser took 0 animals (optional in some rulesets). */
  mengBak: boolean;
  /** Multiplier each applicable 박 imposes. */
  multiplier: number;
  /** Whether multiple 박 stack multiplicatively. */
  stackable: boolean;
}

export interface SpecialRuleConfig {
  /** 흔들기: declare 3-of-a-month from hand before playing → score multiplier. */
  shaking: { enabled: boolean; scoreMultiplier: number };
  /** 폭탄: play 3-of-a-month at once. */
  bomb: { enabled: boolean; scoreMultiplier: number };
  /** 따닥. */
  ttakDak: { enabled: boolean };
  /** 쪽: capture by matching a flipped card to a hand-played single → steal 1 junk. */
  jjok: { enabled: boolean };
  /** 싹쓸이: clear the entire field → steal 1 junk from each opponent. */
  ssakSseuli: { enabled: boolean };
  /** 뻑 (no capture, cards stack on field). */
  ppeok: { enabled: boolean };
  /** 나가리: drawn/exhausted with no winner → next game stakes multiplied. */
  nagari: { enabled: boolean; carryStakeMultiplier: number };
  /** 총통: 4-of-a-month in the opening hand → instant win. */
  chongtong: { enabled: boolean; score: number };
  /** 쇼당: both played and flipped card match the same field month → score multiplier. */
  showdown: { enabled: boolean; scoreMultiplier: number };
}

export interface RuleConfig {
  preset: RulePreset;
  deal: DealConfig;
  scoring: ScoringConfig;
  go: GoConfig;
  bak: BakConfig;
  special: SpecialRuleConfig;
}

/** Recursive partial, used for preset overrides / CUSTOM rules. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};
