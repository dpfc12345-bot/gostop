import { describe, expect, it } from 'vitest';
import { getCard } from '../domain/card/deck.js';
import { resolveRuleConfig } from '../rules/presets.js';
import { versionedScoreCalculator } from '../scoring/score-engine.js';
import type { GameState, PlayerState } from '../state/game-state.js';
import { getLegalActions, reduce } from './reduce.js';

const KUKJIN_ID = 32; // month 9 animal

function player(seat: number, hand: number[]): PlayerState {
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [...hand],
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

function baseState(overrides: Partial<GameState> & Pick<GameState, 'players'>): GameState {
  return {
    gameId: 'kukjin-test',
    seed: 'seed',
    rule: resolveRuleConfig('PMANG_NEWMATGO'),
    scoreEngineVersion: 1,
    phase: 'PLAYING',
    dealer: 0,
    turn: 0,
    turnCount: 1,
    board: { field: {} },
    drawPile: [0],
    stakeMultiplier: 1,
    eventSeq: 0,
    ...overrides,
  };
}

describe('국진 (PLAYER_CHOICE)', () => {
  it('prompts 열끗/피 choice when 국진 is captured', () => {
    const state = baseState({
      players: [player(0, [34]), player(1, [])],
      board: { field: { 9: [KUKJIN_ID] } },
    });

    const { state: next, events } = reduce(state, { type: 'PLAY_CARD', seat: 0, cardId: 34 });
    expect(events.some((e) => e.type === 'KukjinChoiceRequired')).toBe(true);
    expect(next.pending?.kind).toBe('CHOOSE_KUKJIN');
    expect(next.pending && 'cardId' in next.pending ? next.pending.cardId : null).toBe(KUKJIN_ID);
    expect(getLegalActions(next).map((a) => a.type)).toEqual(['CHOOSE_KUKJIN', 'CHOOSE_KUKJIN']);
  });

  it('keeps 국진 in animals when chosen as 열끗', () => {
    let state = baseState({
      players: [player(0, [34]), player(1, [])],
      board: { field: { 9: [KUKJIN_ID] } },
    });
    state = reduce(state, { type: 'PLAY_CARD', seat: 0, cardId: 34 }).state;
    state = reduce(state, { type: 'CHOOSE_KUKJIN', seat: 0, asDoubleJunk: false }).state;

    const captured = state.players[0]!.captured;
    expect(captured.animals).toContain(KUKJIN_ID);
    expect(captured.junk).not.toContain(KUKJIN_ID);
    expect(getCard(KUKJIN_ID).isKukjin).toBe(true);
  });

  it('moves 국진 to junk as 2-point 쌍피 when chosen as 피', () => {
    let state = baseState({
      players: [player(0, [34]), player(1, [])],
      board: { field: { 9: [KUKJIN_ID] } },
    });
    state = reduce(state, { type: 'PLAY_CARD', seat: 0, cardId: 34 }).state;
    state = reduce(state, { type: 'CHOOSE_KUKJIN', seat: 0, asDoubleJunk: true }).state;

    const captured = state.players[0]!.captured;
    expect(captured.junk).toContain(KUKJIN_ID);
    expect(captured.animals).not.toContain(KUKJIN_ID);

    const junkPoints = captured.junk.reduce((sum, id) => {
      const card = getCard(id);
      return sum + (card.isKukjin ? state.rule.scoring.ssangpiValue : 1);
    }, 0);
    expect(junkPoints).toBeGreaterThanOrEqual(2);
    void versionedScoreCalculator;
  });
});
