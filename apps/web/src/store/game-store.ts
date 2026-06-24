import { create } from 'zustand';
import type { GameAction, PlayerView } from '@gostop/engine';
import type {
  ActionAck,
  ClientVisibleEvent,
  GameResultMsg,
  GameSyncMsg,
  ResumeResult,
  RoomStateMsg,
  SpectatorView,
  StateDiffMsg,
} from '@gostop/shared';
import { isPlayerView, mergePlayerView } from '../lib/view-merge.js';
import type { DevUser } from '../lib/storage.js';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LogEntry {
  id: string;
  at: number;
  kind: 'SOCKET' | 'SYNC' | 'DIFF' | 'DECISION' | 'ENDED' | 'ACTION' | 'ACK' | 'ROOM' | 'RESUME';
  summary: string;
  payload?: unknown;
}

export interface ReplayFrame {
  seq: number;
  events: ClientVisibleEvent[];
  view: PlayerView | null;
  stateHash?: string;
}

interface GameStore {
  user: DevUser | null;
  socketStatus: SocketStatus;
  socketError: string | null;
  roomId: string | null;
  room: RoomStateMsg | null;
  view: PlayerView | null;
  eventSeq: number;
  stateHash: string | null;
  legalActions: GameAction[];
  gameResult: GameResultMsg | null;
  isSpectator: boolean;
  spectatorView: SpectatorView | null;
  eventLog: LogEntry[];
  replayFrames: ReplayFrame[];
  lastAck: ActionAck | null;

  setUser: (user: DevUser | null) => void;
  setSocketStatus: (status: SocketStatus, error?: string | null) => void;
  setRoom: (roomId: string | null, room: RoomStateMsg | null) => void;
  applySync: (msg: GameSyncMsg) => void;
  applyDiff: (msg: StateDiffMsg) => void;
  setLegalActions: (actions: GameAction[]) => void;
  setGameResult: (result: GameResultMsg | null) => void;
  setSpectator: (v: boolean) => void;
  log: (entry: Omit<LogEntry, 'id' | 'at'>) => void;
  setLastAck: (ack: ActionAck | null) => void;
  applyResume: (result: ResumeResult) => void;
  resetGame: () => void;
}

function appendLog(state: GameStore, entry: Omit<LogEntry, 'id' | 'at'>): LogEntry[] {
  const row: LogEntry = { ...entry, id: crypto.randomUUID(), at: Date.now() };
  return [...state.eventLog, row].slice(-500);
}

export const useGameStore = create<GameStore>((set, get) => ({
  user: null,
  socketStatus: 'disconnected',
  socketError: null,
  roomId: null,
  room: null,
  view: null,
  eventSeq: -1,
  stateHash: null,
  legalActions: [],
  gameResult: null,
  isSpectator: false,
  spectatorView: null,
  eventLog: [],
  replayFrames: [],
  lastAck: null,

  setUser: (user) => set({ user }),
  setSocketStatus: (socketStatus, socketError = null) => set({ socketStatus, socketError }),
  setRoom: (roomId, room) => set({ roomId, room }),

  applySync: (msg) => {
    const s = get();
    if (isPlayerView(msg.view)) {
      const replayFrames = [
        ...s.replayFrames,
        { seq: msg.seq, events: [], view: msg.view, stateHash: msg.stateHash },
      ];
      set({
        view: msg.view,
        eventSeq: msg.seq,
        stateHash: msg.stateHash ?? null,
        spectatorView: null,
        replayFrames,
        eventLog: appendLog(s, { kind: 'SYNC', summary: `sync seq=${msg.seq}`, payload: msg }),
      });
    } else {
      set({
        spectatorView: msg.view as SpectatorView,
        view: null,
        eventSeq: msg.seq,
        stateHash: msg.stateHash ?? null,
        isSpectator: true,
        eventLog: appendLog(s, {
          kind: 'SYNC',
          summary: `spectator sync seq=${msg.seq}`,
          payload: msg,
        }),
      });
    }
  },

  applyDiff: (msg) => {
    const s = get();
    let nextView = s.view;
    if (nextView && ('self' in msg.patch || isPlayerView(msg.patch))) {
      nextView = mergePlayerView(nextView, msg.patch as Partial<PlayerView>);
    } else if (!nextView && isPlayerView(msg.patch)) {
      nextView = msg.patch as PlayerView;
    }

    const replayFrames = [
      ...s.replayFrames,
      { seq: msg.toSeq, events: msg.events, view: nextView, stateHash: msg.stateHash },
    ];

    set({
      view: nextView,
      eventSeq: msg.toSeq,
      stateHash: msg.stateHash ?? s.stateHash,
      replayFrames,
      eventLog: appendLog(s, {
        kind: 'DIFF',
        summary: `diff ${msg.fromSeq}→${msg.toSeq}`,
        payload: msg,
      }),
    });
  },

  setLegalActions: (legalActions) => {
    const s = get();
    set({
      legalActions,
      eventLog: appendLog(s, {
        kind: 'DECISION',
        summary: `${legalActions.length} legal actions`,
        payload: legalActions,
      }),
    });
  },

  setGameResult: (gameResult) => {
    const s = get();
    set({
      gameResult,
      eventLog: gameResult
        ? appendLog(s, { kind: 'ENDED', summary: `winner seat ${gameResult.winner}`, payload: gameResult })
        : s.eventLog,
    });
  },

  setSpectator: (isSpectator) => set({ isSpectator }),
  log: (entry) => set((s) => ({ eventLog: appendLog(s, entry) })),

  setLastAck: (lastAck) => {
    const s = get();
    set({
      lastAck,
      eventLog: lastAck
        ? appendLog(s, { kind: 'ACK', summary: lastAck.status, payload: lastAck })
        : s.eventLog,
    });
  },

  applyResume: (result) => {
    const s = get();
    set({ eventLog: appendLog(s, { kind: 'RESUME', summary: result.status, payload: result }) });
    if (result.status === 'SYNC') get().applySync(result.sync);
    else if (result.status === 'DIFF') {
      for (const diff of result.diffs) get().applyDiff(diff);
    } else if (result.status === 'ENDED') get().setGameResult(result.result);
  },

  resetGame: () =>
    set({
      view: null,
      eventSeq: -1,
      stateHash: null,
      legalActions: [],
      gameResult: null,
      spectatorView: null,
      replayFrames: [],
      lastAck: null,
    }),
}));
