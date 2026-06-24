import { useCallback } from 'react';
import type { GameAction } from '@gostop/engine';
import type { ActionAck } from '@gostop/shared';
import { getSocket } from '../lib/socket.js';
import { useGameStore } from '../store/game-store.js';

export function useGameActions() {
  const view = useGameStore((s) => s.view);
  const setLastAck = useGameStore((s) => s.setLastAck);
  const log = useGameStore((s) => s.log);

  const sendAction = useCallback(
    (action: GameAction) => {
      const socket = getSocket();
      const gameId = view?.gameId;
      if (!socket || !gameId) return;

      const actionId = crypto.randomUUID();
      log({ kind: 'ACTION', summary: action.type, payload: { actionId, action } });

      socket.emit(
        'game:action',
        { gameId, actionId, action },
        (ack: ActionAck) => setLastAck(ack),
      );
    },
    [view?.gameId, setLastAck, log],
  );

  return { sendAction };
}
