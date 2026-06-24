/**
 * ScoreEngine tests — every scoring case the rules define is verified here:
 * 광 / 열끗 / 띠 / 피 / 단(홍·청·초) / 고 / 박 / 멍따 / 쇼당 / 흔들기 / 폭탄,
 * plus a Golden Score Test, an official-example Snapshot Test, and the
 * version-faithful replay guarantee.
 *
 * Card id reference (id = (month-1)*4 + slot):
 *   광: 0(1) 8(3) 28(8) 40(11) 44(12,비광)
 *   열끗: 4(2,고도리) 12(4,고도리) 16(5) 20(6) 24(7) 29(8,고도리) 32(9,국진) 36(10) 45(12)
 *   띠: 홍단 1·5·9 / 초단 13·17·25 / 청단 21·33·37 / 비띠 46
 *   피(일반,1점): 2 3 6 7 10 11 14 15 18 19 …  쌍피(2점): 43(11) 47(12)
 */
import { describe, expect, it } from 'vitest';
import {
  SCORE_ENGINE_VERSION,
  scoreEngineFor,
  versionedScoreCalculator,
} from './score-engine.js';
import { resolveRuleConfig } from '../rules/presets.js';
import type { CapturedPile, GameState, PlayerState, Seat } from '../state/game-state.js';
import type { RuleConfig } from '../rules/rule-config.js';

function pile(p: Partial<CapturedPile>): CapturedPile {
  return { brights: p.brights ?? [], animals: p.animals ?? [], ribbons: p.ribbons ?? [], junk: p.junk ?? [] };
}

function player(seat: Seat, captured: CapturedPile, extra: Partial<PlayerState> = {}): PlayerState {
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [],
    captured,
    goCount: 0,
    lastGoScore: 0,
    hasShaken: false,
    shakenMonths: [],
    bombCount: 0,
    mungtta: false,
    showdownCount: 0,
    connected: true,
    ...extra,
  };
}

function stateWith(players: PlayerState[], rule?: RuleConfig): GameState {
  return {
    gameId: 't',
    seed: 't',
    rule: rule ?? resolveRuleConfig('PMANG_NEWMATGO'),
    scoreEngineVersion: SCORE_ENGINE_VERSION,
    phase: 'PLAYING',
    players,
    dealer: 0,
    turn: 0,
    turnCount: 1,
    board: { field: {} },
    drawPile: [],
    stakeMultiplier: 1,
    eventSeq: 0,
  };
}

/** Evaluate seat 0's own score under PMANG (no 박). */
function score(captured: CapturedPile, extra: Partial<PlayerState> = {}, rule?: RuleConfig) {
  const state = stateWith([player(0, captured, extra), player(1, pile({}))], rule);
  return versionedScoreCalculator.evaluate(state, 0).breakdown;
}

function codes(b: { components: { code: string }[] }): string[] {
  return b.components.map((c) => c.code);
}

describe('ScoreEngine — 광 (brights)', () => {
  it('삼광 (no rain) = 3', () => {
    const b = score(pile({ brights: [0, 8, 28] }));
    expect(codes(b)).toEqual(['GWANG_3']);
    expect(b.total).toBe(3);
  });
  it('비삼광 (with rain) = 2', () => {
    const b = score(pile({ brights: [0, 8, 44] }));
    expect(codes(b)).toEqual(['GWANG_3_BI']);
    expect(b.total).toBe(2);
  });
  it('사광 = 4, 오광 = 15', () => {
    expect(score(pile({ brights: [0, 8, 28, 40] })).total).toBe(4);
    expect(score(pile({ brights: [0, 8, 28, 40, 44] })).total).toBe(15);
  });
});

describe('ScoreEngine — 열끗 / 고도리 / 멍따', () => {
  it('5 animals = 1, then +1 each', () => {
    expect(score(pile({ animals: [16, 20, 24, 36, 45] })).total).toBe(1);
    expect(score(pile({ animals: [16, 20, 24, 36, 45, 4] })).total).toBe(2);
  });
  it('고도리 (3 birds) = +5', () => {
    const b = score(pile({ animals: [4, 12, 29, 16, 20] }));
    expect(codes(b)).toEqual(['YEOLKKUT', 'GODORI']);
    expect(b.total).toBe(1 + 5);
  });
  it('멍따 flag set at 7 animals (PMANG bonus 0 → flag only)', () => {
    const b = score(pile({ animals: [16, 20, 24, 36, 45, 4, 12] }));
    expect(b.mungtta).toBe(true);
    expect(b.total).toBe(3); // 7 animals → 1 + 2, no bonus points
  });
  it('멍따 bonus applies when configured', () => {
    const rule = resolveRuleConfig('PMANG_NEWMATGO', { scoring: { mungDdaBonus: 5 } });
    const b = score(pile({ animals: [16, 20, 24, 36, 45, 4, 12] }), {}, rule);
    expect(codes(b)).toContain('MUNGTTA');
    expect(b.total).toBe(3 + 5);
  });
});

describe('ScoreEngine — 띠 / 단', () => {
  it('5 ribbons (no set) = 1', () => {
    const b = score(pile({ ribbons: [1, 13, 21, 46, 25] }));
    expect(codes(b)).toEqual(['TTI']);
    expect(b.total).toBe(1);
  });
  it('홍단 / 청단 / 초단 = 3 each', () => {
    expect(score(pile({ ribbons: [1, 5, 9] })).total).toBe(3);
    expect(codes(score(pile({ ribbons: [1, 5, 9] })))).toEqual(['HONGDAN']);
    expect(score(pile({ ribbons: [21, 33, 37] })).total).toBe(3);
    expect(score(pile({ ribbons: [13, 17, 25] })).total).toBe(3);
  });
});

describe('ScoreEngine — 피 (junk)', () => {
  it('10 junk-points = 1, then +1 each', () => {
    expect(score(pile({ junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 19] })).total).toBe(1);
    expect(score(pile({ junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 22] })).total).toBe(2);
  });
  it('쌍피 counts as 2 points', () => {
    // 9 normal (9) + 1 쌍피 (2) = 11 points → 1 + 1 = 2.
    const b = score(pile({ junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 43] }));
    expect(codes(b)).toEqual(['PI']);
    expect(b.total).toBe(2);
  });
});

describe('ScoreEngine — 고 (go bonus & multiplier)', () => {
  it('2고 = +2 additive, no multiplier yet', () => {
    const b = score(pile({ brights: [0, 8, 28] }), { goCount: 2 });
    expect(b.goBonus).toBe(2);
    expect(b.multiplier).toBe(1);
    expect(b.total).toBe((3 + 2) * 1);
  });
  it('3고 = +3 additive and ×2 multiplier', () => {
    const b = score(pile({ brights: [0, 8, 28] }), { goCount: 3 });
    expect(b.goBonus).toBe(3);
    expect(b.multiplier).toBe(2);
    expect(b.total).toBe((3 + 3) * 2);
  });
});

describe('ScoreEngine — 흔들기 / 폭탄 / 쇼당 multipliers', () => {
  it('흔들기 ×2', () => {
    const b = score(pile({ brights: [0, 8, 28] }), { hasShaken: true, shakenMonths: [1] });
    expect(b.multipliers.map((m) => m.code)).toContain('SHAKE');
    expect(b.total).toBe(3 * 2);
  });
  it('폭탄 ×2 per bomb', () => {
    expect(score(pile({ brights: [0, 8, 28] }), { bombCount: 1 }).total).toBe(3 * 2);
    expect(score(pile({ brights: [0, 8, 28] }), { bombCount: 2 }).total).toBe(3 * 4);
  });
  it('쇼당 ×2', () => {
    const b = score(pile({ brights: [0, 8, 28] }), { showdownCount: 1 });
    expect(b.multipliers.map((m) => m.code)).toContain('SHOWDOWN');
    expect(b.total).toBe(3 * 2);
  });
});

describe('ScoreEngine — 박 (settlement)', () => {
  it('광박 + 피박 stack to ×4 against a junk-poor, bright-less loser', () => {
    const winner = player(0, pile({ brights: [0, 8, 28] })); // 3광, base 3
    const loser = player(1, pile({ animals: [16, 20, 24, 36, 45] })); // no 광, 0 피
    const state = stateWith([winner, loser]);

    const settled = versionedScoreCalculator.settle(state, 0);
    expect(settled.appliedBak.sort()).toEqual(['GWANG_BAK', 'PI_BAK']);
    expect(settled.multiplier).toBe(4); // ×2 ×2 (stackable)
    expect(settled.total).toBe(3 * 4);
  });

  it('고박 — a loser who declared 고 doubles the winner take', () => {
    const winner = player(0, pile({ junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 19] })); // 피 1
    const loser = player(1, pile({ junk: [22, 23, 26, 27, 30, 31, 34, 35] }), { goCount: 1 }); // 8 피 → no 피박
    const state = stateWith([winner, loser]);
    const settled = versionedScoreCalculator.settle(state, 0);
    expect(settled.appliedBak).toContain('GO_BAK');
  });
});

describe('ScoreEngine — Golden Score Test', () => {
  it('a rich pile resolves to a pinned, fully-explained breakdown', () => {
    const captured = pile({
      brights: [0, 8, 28], // 삼광 = 3
      animals: [4, 12, 29, 16, 20], // 5열끗(1) + 고도리(5)
      ribbons: [1, 5, 9], // 홍단(3)
      junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 19], // 10피 = 1
    });
    const b = score(captured);
    expect(b.base).toBe(13);
    expect(b.goBonus).toBe(0);
    expect(b.multiplier).toBe(1);
    expect(b.total).toBe(13);
    expect(codes(b)).toEqual(['GWANG_3', 'YEOLKKUT', 'GODORI', 'HONGDAN', 'PI']);
  });
});

describe('ScoreEngine — official-example Snapshot Test', () => {
  it('canonical hands snapshot (full breakdown for replay explainability)', () => {
    const examples = {
      threeBright: score(pile({ brights: [0, 8, 28] })),
      godoriHand: score(pile({ animals: [4, 12, 29, 16, 20] })),
      sevenGoMultiplier: score(pile({ brights: [0, 8, 28, 40, 44] }), { goCount: 3 }),
      shakenBomb: score(pile({ brights: [0, 8, 28] }), {
        hasShaken: true,
        shakenMonths: [1],
        bombCount: 1,
      }),
    };
    expect(examples).toMatchSnapshot();
  });
});

describe('ScoreEngine — versioned replay', () => {
  it('dispatches by the recorded scoreEngineVersion and rejects unknown versions', () => {
    expect(SCORE_ENGINE_VERSION).toBe(1);
    expect(scoreEngineFor(1).version).toBe(1);
    expect(() => scoreEngineFor(999)).toThrowError(/unknown ScoreEngine version/i);

    // The dispatcher uses state.scoreEngineVersion, so a game pinned to v1 keeps
    // scoring with v1 regardless of any future default engine version.
    const state = stateWith([player(0, pile({ brights: [0, 8, 28] })), player(1, pile({}))]);
    const viaDispatcher = versionedScoreCalculator.evaluate(state, 0).total;
    const viaV1 = scoreEngineFor(1).evaluate(state, 0).total;
    expect(viaDispatcher).toBe(viaV1);
  });
});
