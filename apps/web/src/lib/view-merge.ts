import type { PlayerView } from '@gostop/engine';

/** Type guard — PlayerView always has `self`. */
export function isPlayerView(view: unknown): view is PlayerView {
  return typeof view === 'object' && view !== null && 'self' in view;
}

/**
 * Merge a server StateDiff patch into the current PlayerView.
 * The server sends the full projected view as a patch; nested public state
 * (board.field, opponents) must replace — not key-merge — so captured months
 * disappear from the field on the client.
 */
export function mergePlayerView(
  base: PlayerView | null,
  patch: Partial<PlayerView>,
): PlayerView {
  if (!base) {
    if (!isPlayerView(patch)) {
      throw new Error('initial patch must contain a full PlayerView (self required)');
    }
    return patch;
  }

  const isFullViewPatch = patch.self !== undefined && patch.board !== undefined;

  const merged: PlayerView = {
    ...base,
    ...patch,
    self: patch.self ? { ...base.self, ...patch.self } : base.self,
    opponents: patch.opponents ?? base.opponents,
    board: patch.board
      ? { field: { ...(patch.board.field ?? {}) } }
      : base.board,
  };

  // Full server patches omit `pending` when cleared (after 고/스톱, match, etc.).
  if (isFullViewPatch) {
    if (patch.pending !== undefined) merged.pending = patch.pending;
    else delete merged.pending;
  } else if (patch.pending !== undefined) {
    merged.pending = patch.pending;
  }

  return merged;
}
