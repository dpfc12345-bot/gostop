/**
 * Rule configuration (this step) + the RuleEngine resolvers (step 6).
 *
 * RuleConfig holds every tunable for scoring and special rules; the step-6
 * RuleEngine reads it to decide legality and which special events fire (고/스톱,
 * 광박, 피박, 고박, 폭탄, 흔들기, 따닥, 쪽, 싹쓸이, 나가리, 총통, 멍따, 쇼당).
 */
export * from './rule-config.js';
export * from './presets.js';
export * from './rule-engine.js';
