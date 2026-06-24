import {
  SCORE_ENGINE_VERSION,
  resolveRuleConfig,
  scoreEngineFor,
  type CapturedPile,
  type GameState,
  type PlayerState,
  type RulePreset,
  type ScoreBreakdown,
  type Seat,
} from '@gostop/engine';

function emptyPlayer(seat: Seat): PlayerState {
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [],
    captured: { brights: [], animals: [], ribbons: [], junk: [] },
    goCount: 0,
    lastGoScore: 0,
    hasShaken: false,
    shakenMonths: [],
    bombCount: 0,
    mungtta: false,
    showdownCount: 0,
    connected: true,
  };
}

/** Live score from public captured piles (same logic as server 고/스톱 gate). */
export function previewScoreFromCapture(params: {
  rulePreset: RulePreset;
  seat: Seat;
  captured: CapturedPile;
  goCount: number;
  hasShaken: boolean;
}): ScoreBreakdown {
  const rule = resolveRuleConfig(params.rulePreset);
  const player: PlayerState = {
    ...emptyPlayer(params.seat),
    captured: params.captured,
    goCount: params.goCount,
    hasShaken: params.hasShaken,
  };
  const other = emptyPlayer(params.seat === 0 ? 1 : 0);
  const state: GameState = {
    gameId: 'score-preview',
    seed: 'score-preview',
    rule,
    scoreEngineVersion: SCORE_ENGINE_VERSION,
    phase: 'PLAYING',
    players: params.seat === 0 ? [player, other] : [other, player],
    dealer: 0,
    turn: params.seat,
    turnCount: 1,
    board: { field: {} },
    drawPile: [],
    stakeMultiplier: 1,
    eventSeq: 0,
  };
  return scoreEngineFor(SCORE_ENGINE_VERSION).evaluate(state, params.seat).breakdown;
}

export function formatScoreSummary(breakdown: ScoreBreakdown): string {
  const parts: string[] = [];
  for (const c of breakdown.components) {
    parts.push(`${c.label} ${c.points}`);
  }
  if (breakdown.goBonus > 0) parts.push(`고보너스 +${breakdown.goBonus}`);
  for (const m of breakdown.multipliers) {
    parts.push(`${m.label} ×${m.factor}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '아직 득점 없음';
}
