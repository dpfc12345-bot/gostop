/**
 * Engine dependencies — the seams where the RuleEngine (step 6) and the
 * ScoreCalculator (step 7) plug in. Both now ship real, version-aware
 * implementations; tests may inject `stubScoreCalculator` to disable scoring.
 */
import { defaultRuleEngine, type RuleEngine } from '../rules/rule-engine.js';
import { versionedScoreCalculator, type ScoreCalculator } from '../scoring/score-engine.js';

export interface EngineDeps {
  score: ScoreCalculator;
  rules: RuleEngine;
}

export const defaultDeps: EngineDeps = {
  score: versionedScoreCalculator,
  rules: defaultRuleEngine,
};
