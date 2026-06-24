import { projectView, type GameState, type Seat } from '@gostop/engine';
import type { PlayerView } from '@gostop/engine';
import type { SpectatorView } from '@gostop/shared';

/** Derive a spectator-safe view (no hidden hands). */
export function projectSpectatorView(state: GameState): SpectatorView {
  const players = state.players.map((p) => ({
    seat: p.seat,
    playerId: p.playerId,
    isAi: p.isAi,
    captured: {
      brights: [...p.captured.brights],
      animals: [...p.captured.animals],
      ribbons: [...p.captured.ribbons],
      junk: [...p.captured.junk],
    },
    handCount: p.hand.length,
    goCount: p.goCount,
    hasShaken: p.hasShaken,
    connected: p.connected,
  }));

  const field = Object.fromEntries(
    Object.entries(state.board.field).map(([m, ids]) => [m, [...(ids ?? [])]]),
  ) as SpectatorView['board']['field'];

  const pending =
    state.pending !== undefined
      ? { kind: state.pending.kind, seat: state.pending.seat }
      : undefined;

  return {
    gameId: state.gameId,
    rulePreset: state.rule.preset,
    phase: state.phase,
    turn: state.turn,
    turnCount: state.turnCount,
    dealer: state.dealer,
    stakeMultiplier: state.stakeMultiplier,
    players,
    board: { field },
    drawPileCount: state.drawPile.length,
    ...(pending !== undefined ? { pending } : {}),
    winner: state.winner ?? null,
    ...(state.finalScore !== undefined ? { finalScore: state.finalScore } : {}),
  };
}

export function projectPlayerView(state: GameState, seat: Seat): PlayerView {
  return projectView(state, seat);
}

/** Shallow patch for StateDiff — client merges over its cached view. */
export function viewToPatch(view: PlayerView | SpectatorView): Partial<PlayerView | SpectatorView> {
  return { ...view };
}
