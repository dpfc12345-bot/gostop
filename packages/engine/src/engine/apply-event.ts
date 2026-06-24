/**
 * applyEvent — the ONLY way game state changes. Pure and total: it never reads
 * the clock or randomness and never mutates its input; it returns a new state.
 * `reduce` advances the game solely by folding the events it emits through this
 * function, which is what guarantees reduce ≡ replay.
 */
import type { Card, CardId, Month } from '../domain/card/card.js';
import { getCard } from '../domain/card/deck.js';
import { resolveRuleConfig } from '../rules/presets.js';
import type {
  BoardState,
  CapturedPile,
  FieldPiles,
  GameState,
  PlayerState,
  Seat,
} from '../state/game-state.js';
import type { GameEvent } from '../events/events.js';
import { SCORE_ENGINE_VERSION } from '../scoring/score-engine.js';

function emptyPile(): CapturedPile {
  return { brights: [], animals: [], ribbons: [], junk: [] };
}

/** A blank state used as the fold seed for replay; GameCreated populates it. */
export function initialStateForReplay(): GameState {
  return {
    gameId: '',
    seed: '',
    rule: resolveRuleConfig('PMANG_NEWMATGO'),
    scoreEngineVersion: SCORE_ENGINE_VERSION,
    phase: 'CREATED',
    players: [],
    dealer: 0,
    turn: 0,
    turnCount: 0,
    board: { field: {} },
    drawPile: [],
    stakeMultiplier: 1,
    eventSeq: 0,
  };
}

function withPlayer(
  state: GameState,
  seat: Seat,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? fn(p) : p)) };
}

function removeOne<T>(arr: readonly T[], value: T): T[] {
  const i = arr.indexOf(value);
  if (i < 0) return arr.slice();
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

function pileKey(card: Card): keyof CapturedPile {
  switch (card.category) {
    case 'BRIGHT':
      return 'brights';
    case 'ANIMAL':
      return 'animals';
    case 'RIBBON':
      return 'ribbons';
    case 'JUNK':
      return 'junk';
  }
}

function addCardsToPile(pile: CapturedPile, cardIds: readonly CardId[]): CapturedPile {
  const next: CapturedPile = {
    brights: [...pile.brights],
    animals: [...pile.animals],
    ribbons: [...pile.ribbons],
    junk: [...pile.junk],
  };
  for (const id of cardIds) {
    next[pileKey(getCard(id))].push(id);
  }
  return next;
}

function placeOnField(field: FieldPiles, cardId: CardId): FieldPiles {
  const month = getCard(cardId).month;
  return { ...field, [month]: [...(field[month] ?? []), cardId] };
}

function removeCardsFromField(field: FieldPiles, cardIds: readonly CardId[]): FieldPiles {
  const remove = new Set(cardIds);
  const next: FieldPiles = {};
  for (const [monthKey, ids] of Object.entries(field)) {
    const kept = (ids ?? []).filter((id) => !remove.has(id));
    if (kept.length > 0) next[Number(monthKey) as Month] = kept;
  }
  return next;
}

function groupByMonth(cardIds: readonly CardId[]): FieldPiles {
  const field: FieldPiles = {};
  for (const id of cardIds) {
    const month = getCard(id).month;
    field[month] = [...(field[month] ?? []), id];
  }
  return field;
}

function applyEventInner(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'GameCreated': {
      const players: PlayerState[] = event.players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({
          seat: p.seat,
          playerId: p.playerId,
          isAi: p.isAi,
          hand: [],
          captured: emptyPile(),
          goCount: 0,
          lastGoScore: 0,
          hasShaken: false,
          shakenMonths: [],
          bombCount: 0,
          mungtta: false,
          showdownCount: 0,
          connected: true,
        }));
      return {
        ...state,
        gameId: event.gameId,
        seed: event.seed,
        rule: event.rule,
        scoreEngineVersion: event.scoreEngineVersion,
        players,
        dealer: event.dealer,
        turn: event.dealer,
        turnCount: 0,
        phase: 'DEALING',
        board: { field: {} },
        drawPile: [],
        stakeMultiplier: 1,
        pending: undefined,
        winner: undefined,
        finalScore: undefined,
      };
    }

    case 'CardsDealt': {
      const handBySeat = new Map(event.hands.map((h) => [h.seat, h.cardIds]));
      const players = state.players.map((p) => ({ ...p, hand: [...(handBySeat.get(p.seat) ?? [])] }));
      const board: BoardState = { field: groupByMonth(event.field) };
      return { ...state, players, board, drawPile: [...event.drawPile] };
    }

    case 'TurnStarted':
      return {
        ...state,
        turn: event.seat,
        turnCount: event.turnCount,
        phase: 'PLAYING',
        pending: undefined,
      };

    case 'PlayerPlayedCard':
      return withPlayer(state, event.seat, (p) => ({ ...p, hand: removeOne(p.hand, event.cardId) }));

    case 'CardPlacedOnField':
      return { ...state, board: { field: placeOnField(state.board.field, event.cardId) } };

    case 'CardFlippedFromDeck':
      return {
        ...state,
        drawPile: removeOne(state.drawPile, event.cardId),
        phase: 'PLAYING',
        pending: undefined,
      };

    case 'MatchChoiceRequired':
      return {
        ...state,
        phase: 'AWAITING_DECISION',
        pending: {
          kind: 'CHOOSE_MATCH',
          seat: event.seat,
          playedCardId: event.playedCardId,
          month: event.month,
          candidates: [...event.candidates],
          choices: { ...event.choices },
        },
      };

    case 'JunkStolen': {
      const fromCleared = withPlayer(state, event.fromSeat, (p) => ({
        ...p,
        captured: { ...p.captured, junk: removeOne(p.captured.junk, event.cardId) },
      }));
      return withPlayer(fromCleared, event.toSeat, (p) => ({
        ...p,
        captured: { ...p.captured, junk: [...p.captured.junk, event.cardId] },
      }));
    }

    case 'CardsCaptured': {
      const board: BoardState = { field: removeCardsFromField(state.board.field, event.cardIds) };
      const withBoard = { ...state, board };
      return withPlayer(withBoard, event.seat, (p) => ({
        ...p,
        captured: addCardsToPile(p.captured, event.cardIds),
      }));
    }

    case 'ShakeDeclared':
      return withPlayer(state, event.seat, (p) => ({
        ...p,
        hasShaken: true,
        shakenMonths: p.shakenMonths.includes(event.month)
          ? p.shakenMonths
          : [...p.shakenMonths, event.month],
      }));

    case 'BombDeclared':
      return withPlayer(state, event.seat, (p) => {
        let hand = p.hand;
        for (const id of event.cardIds) hand = removeOne(hand, id);
        return { ...p, hand, bombCount: p.bombCount + 1 };
      });

    case 'ShowdownOccurred':
      return withPlayer(state, event.seat, (p) => ({
        ...p,
        showdownCount: p.showdownCount + 1,
      }));

    case 'MungttaAchieved':
      return withPlayer(state, event.seat, (p) => ({ ...p, mungtta: true }));

    case 'KukjinChoiceRequired':
      return {
        ...state,
        phase: 'AWAITING_DECISION',
        pending: {
          kind: 'CHOOSE_KUKJIN',
          seat: event.seat,
          cardId: event.cardId,
          after: event.after,
        },
      };

    case 'KukjinDeclared': {
      const withPile = withPlayer(state, event.seat, (p) => {
        if (!event.asDoubleJunk) return p;
        return {
          ...p,
          captured: {
            ...p.captured,
            animals: removeOne(p.captured.animals, event.cardId),
            junk: [...p.captured.junk, event.cardId],
          },
        };
      });
      return { ...withPile, phase: 'PLAYING', pending: undefined };
    }

    case 'GoStopRequired':
      return {
        ...state,
        phase: 'AWAITING_DECISION',
        pending: { kind: 'GO_OR_STOP', seat: event.seat, currentScore: event.score },
      };

    case 'GoSelected':
      return withPlayer(
        { ...state, phase: 'PLAYING', pending: undefined },
        event.seat,
        (p) => ({ ...p, goCount: event.goCount, lastGoScore: event.score }),
      );

    case 'StopSelected':
      return state;

    case 'GameEnded':
      return {
        ...state,
        phase: 'FINISHED',
        pending: undefined,
        winner: event.winner,
        finalScore: event.score,
      };

    default:
      // Events not emitted in step 5 (specials/scoring) leave state unchanged.
      return state;
  }
}

export function applyEvent(state: GameState, event: GameEvent): GameState {
  const next = applyEventInner(state, event);
  return { ...next, eventSeq: state.eventSeq + 1 };
}
