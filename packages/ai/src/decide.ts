import type { GameAction, PlayerView } from '@gostop/engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const AI_BOT_ID = '__ai_bot__';
export const AI_BOT_NICKNAME = 'AI 상대';

/**
 * Pick a legal action from the AI's visible state.
 * Pure function — no I/O. Caller supplies legal actions from server authority.
 */
export function decide(view: PlayerView, legal: readonly GameAction[], difficulty: Difficulty = 'normal'): GameAction {
  if (legal.length === 0) {
    throw new Error('decide: no legal actions');
  }

  const seat = view.self.seat;

  const stop = legal.find((a) => a.type === 'DECLARE_STOP');
  const go = legal.find((a) => a.type === 'DECLARE_GO');
  if (stop || go) {
    return pickGoStop(view, stop, go, difficulty);
  }

  const match = legal.find((a) => a.type === 'CHOOSE_MATCH');
  if (match) {
    return match;
  }

  const kukjinDouble = legal.find((a) => a.type === 'CHOOSE_KUKJIN' && a.asDoubleJunk);
  const kukjinSingle = legal.find((a) => a.type === 'CHOOSE_KUKJIN' && !a.asDoubleJunk);
  if (kukjinDouble || kukjinSingle) {
    return difficulty === 'easy' ? (kukjinSingle ?? kukjinDouble!) : (kukjinDouble ?? kukjinSingle!);
  }

  const bomb = legal.find((a) => a.type === 'PLAY_BOMB');
  if (bomb && difficulty !== 'easy') {
    return bomb;
  }

  const shake = legal.find((a) => a.type === 'DECLARE_SHAKE');
  if (shake && difficulty === 'hard') {
    return shake;
  }

  const plays = legal.filter((a): a is Extract<GameAction, { type: 'PLAY_CARD' }> => a.type === 'PLAY_CARD');
  if (plays.length > 0) {
    return pickPlayCard(view, plays, difficulty);
  }

  return legal[0]!;
}

function pickGoStop(
  view: PlayerView,
  stop: GameAction | undefined,
  go: GameAction | undefined,
  difficulty: Difficulty,
): GameAction {
  const pending = view.pending;
  const score = pending && 'currentScore' in pending ? pending.currentScore : 0;
  const minWin = 7;

  if (stop && score >= minWin) {
    if (difficulty === 'hard' && view.self.goCount < 2 && score < 12 && go) {
      return go;
    }
    return stop;
  }

  if (go) return go;
  if (stop) return stop;
  throw new Error('decide: GO_OR_STOP without actions');
}

function pickPlayCard(
  view: PlayerView,
  plays: Extract<GameAction, { type: 'PLAY_CARD' }>[],
  difficulty: Difficulty,
): GameAction {
  const fieldMonths = new Set(
    Object.keys(view.board.field).map((m) => Number(m)),
  );

  const matching = plays.filter((a) => fieldMonths.has(getMonth(a.cardId)));
  if (matching.length > 0) {
    if (difficulty === 'easy') {
      return matching[0]!;
    }
    return matching.sort((a, b) => a.cardId - b.cardId)[0]!;
  }

  if (difficulty === 'easy') {
    return plays[Math.floor(Math.random() * plays.length)]!;
  }

  return plays.sort((a, b) => a.cardId - b.cardId)[0]!;
}

function getMonth(cardId: number): number {
  return Math.floor(cardId / 4) + 1;
}
