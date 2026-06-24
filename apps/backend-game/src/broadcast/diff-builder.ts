import { hashState, type GameEvent, type GameState } from '@gostop/engine';
import type { StateDiffMsg } from '@gostop/shared';
import { redactEvents } from './event-redactor.js';
import {
  projectPlayerView,
  projectSpectatorView,
  viewToPatch,
} from './view-projector.js';

export interface DiffRecipient {
  socketId: string;
  seat: number | null;
  isSpectator: boolean;
}

export function buildStateDiffs(
  state: GameState,
  fromSeq: number,
  toSeq: number,
  events: readonly GameEvent[],
  recipients: readonly DiffRecipient[],
): StateDiffMsg[] {
  const stateHash = hashState(state);
  const visible = redactEvents(events);
  const diffs: StateDiffMsg[] = [];

  for (const r of recipients) {
    if (r.isSpectator || r.seat === null) {
      const view = projectSpectatorView(state);
      diffs.push({
        gameId: state.gameId,
        fromSeq,
        toSeq,
        events: visible,
        patch: viewToPatch(view),
        stateHash,
      });
    } else {
      const view = projectPlayerView(state, r.seat);
      diffs.push({
        gameId: state.gameId,
        fromSeq,
        toSeq,
        events: visible,
        patch: viewToPatch(view),
        stateHash,
      });
    }
  }
  return diffs;
}
