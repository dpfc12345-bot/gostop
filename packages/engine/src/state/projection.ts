/**
 * projectView — derive a single seat's PlayerView from the authoritative
 * GameState. This is the hidden-information firewall: it is the only sanctioned
 * way to expose game data to a client. Everything it returns is a fresh copy so
 * callers cannot mutate engine state and cards never leak by reference.
 */
import type { CapturedPile, GameState, PendingDecision, Seat } from './game-state.js';
import type { OpponentView, PendingDecisionView, PlayerView, SelfView } from './player-view.js';

function cloneCaptured(pile: CapturedPile): CapturedPile {
  return {
    brights: [...pile.brights],
    animals: [...pile.animals],
    ribbons: [...pile.ribbons],
    junk: [...pile.junk],
  };
}

function projectPending(
  pending: PendingDecision | undefined,
  viewer: Seat,
): PendingDecisionView | undefined {
  if (pending === undefined) return undefined;
  if (pending.seat === viewer) return pending;
  return { kind: pending.kind, seat: pending.seat, ownedByViewer: false };
}

export function projectView(state: GameState, viewer: Seat): PlayerView {
  const self = state.players.find((p) => p.seat === viewer);
  if (self === undefined) {
    throw new RangeError(`seat ${viewer} is not part of game ${state.gameId}`);
  }

  const selfView: SelfView = {
    seat: self.seat,
    playerId: self.playerId,
    hand: [...self.hand],
    captured: cloneCaptured(self.captured),
    goCount: self.goCount,
    hasShaken: self.hasShaken,
  };

  const opponents: OpponentView[] = state.players
    .filter((p) => p.seat !== viewer)
    .map((p) => ({
      seat: p.seat,
      playerId: p.playerId,
      isAi: p.isAi,
      captured: cloneCaptured(p.captured),
      handCount: p.hand.length,
      goCount: p.goCount,
      hasShaken: p.hasShaken,
      connected: p.connected,
    }));

  const field = Object.fromEntries(
    Object.entries(state.board.field).map(([month, ids]) => [month, [...(ids ?? [])]]),
  ) as PlayerView['board']['field'];

  const view: PlayerView = {
    gameId: state.gameId,
    rulePreset: state.rule.preset,
    phase: state.phase,
    turn: state.turn,
    turnCount: state.turnCount,
    dealer: state.dealer,
    stakeMultiplier: state.stakeMultiplier,
    self: selfView,
    opponents,
    board: { field },
    drawPileCount: state.drawPile.length,
    ...(projectPending(state.pending, viewer) !== undefined
      ? { pending: projectPending(state.pending, viewer) }
      : {}),
    winner: state.winner ?? null,
    ...(state.finalScore !== undefined ? { finalScore: state.finalScore } : {}),
  };

  return view;
}
