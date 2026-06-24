import { randomUUID } from 'node:crypto';
import {
  EngineError,
  getLegalActions,
  hashState,
  projectView,
  type GameEvent,
  type GameState,
  type ScoreBreakdown,
} from '@gostop/engine';
import { AI_BOT_ID, AI_BOT_NICKNAME, decide } from '@gostop/ai';
import type {
  ActionAck,
  ActionEnvelope,
  ApiError,
  GameResultMsg,
  GameSyncMsg,
  ResumeRequest,
  ResumeResult,
  RoomJoinResult,
  RoomStateMsg,
  StateDiffMsg,
} from '@gostop/shared';
import { DIFF_HISTORY_LIMIT, SNAPSHOT_INTERVAL } from '../config/constants.js';
import { buildStateDiffs } from '../broadcast/diff-builder.js';
import { projectPlayerView, projectSpectatorView } from '../broadcast/view-projector.js';
import { recoverGameState } from '../persistence/game-recovery.js';
import type { DiffBatch, RoomActorDeps, RoomMember, RoomStatus } from './room.types.js';

/**
 * RoomActor — the ONLY place game logic runs on the server.
 *
 * Enforced pipeline for every action:
 *   Action → reduce (Events) → EventStore.append → commit State → Broadcast
 *
 * If EventStore.append throws, in-memory State is NOT updated.
 * All mutations run under a Redis (or in-memory) lock per room.
 */
export class RoomActor {
  readonly roomId: string;
  gameId: string | null = null;
  state: GameState | null = null;
  /** Latest stored event seq (0-based), or -1 before genesis. */
  eventSeq = -1;
  status: RoomStatus = 'WAITING';

  private readonly members = new Map<string, RoomMember>();
  private readonly socketToUser = new Map<string, string>();
  private readonly diffBatches: DiffBatch[] = [];
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private soloMode = false;
  private aiBusy = false;

  constructor(
    roomId: string,
    private readonly deps: RoomActorDeps,
  ) {
    this.roomId = roomId;
  }

  /** Rehydrate a room after server restart (EventStore + Snapshot). */
  static async recover(
    roomId: string,
    gameId: string,
    deps: RoomActorDeps,
  ): Promise<RoomActor> {
    const actor = new RoomActor(roomId, deps);
    const recovered = await recoverGameState(gameId, deps.eventStore, deps.snapshotStore);
    actor.gameId = gameId;
    actor.state = recovered.state;
    actor.eventSeq = recovered.eventSeq;
    actor.status = recovered.state.phase === 'FINISHED' ? 'FINISHED' : 'IN_PROGRESS';
    return actor;
  }

  getMember(userId: string): RoomMember | undefined {
    return this.members.get(userId);
  }

  findBySocket(socketId: string): RoomMember | undefined {
    const userId = this.socketToUser.get(socketId);
    return userId ? this.members.get(userId) : undefined;
  }

  async join(params: {
    userId: string;
    socketId: string;
    nickname: string;
    asSpectator?: boolean;
    solo?: boolean;
  }): Promise<RoomJoinResult> {
    const solo = params.solo === true || this.roomId.startsWith('solo-');
    if (solo && !params.asSpectator) {
      this.soloMode = true;
    }

    const existing = this.members.get(params.userId);
    if (existing) {
      existing.socketId = params.socketId;
      existing.connected = true;
      this.socketToUser.set(params.socketId, params.userId);
    } else {
      const seated = [...this.members.values()].filter((m) => !m.isSpectator && !m.isAi).length;
      const asSpectator = params.asSpectator === true || (!solo && seated >= 2);
      const member: RoomMember = {
        userId: params.userId,
        socketId: params.socketId,
        nickname: params.nickname,
        seat: asSpectator ? null : seated,
        isSpectator: asSpectator,
        ready: asSpectator,
        connected: true,
        isAi: false,
      };
      this.members.set(params.userId, member);
      this.socketToUser.set(params.socketId, params.userId);
    }

    if (this.soloMode) {
      this.ensureAiOpponent();
      const human = [...this.members.values()].find((m) => !m.isSpectator && !m.isAi);
      if (human) human.ready = true;
      if (this.state?.phase === 'FINISHED') {
        this.resetForNewGame();
      }
    }

    this.emitRoomState();
    await this.tryStartGame();
    const finalSync = this.state ? this.buildSyncFor(params.userId) : undefined;
    if (finalSync && this.state) {
      this.scheduleAiTurn();
      this.maybeEmitPlayingDeclarations(this.state, this.eventSeq);
    }
    return {
      status: 'OK',
      room: this.roomStateMsg(),
      ...(finalSync !== undefined ? { sync: finalSync } : {}),
    };
  }

  leave(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;
    const member = this.members.get(userId);
    if (member) member.connected = false;
    this.socketToUser.delete(socketId);
    if (this.state) {
      const seat = member?.seat;
      if (seat !== null && seat !== undefined) {
        this.state = {
          ...this.state,
          players: this.state.players.map((p) =>
            p.seat === seat ? { ...p, connected: false } : p,
          ),
        };
      }
    }
    this.emitRoomState();
  }

  async setReady(userId: string, ready: boolean): Promise<void> {
    const member = this.members.get(userId);
    if (!member || member.isSpectator) return;
    member.ready = ready;
    this.emitRoomState();
    await this.tryStartGame();
  }

  /**
   * Process a client action. ONLY entry point for gameplay mutations.
   * Action → Event → EventStore → State → Broadcast
   */
  async handleAction(envelope: ActionEnvelope, userId: string): Promise<ActionAck> {
    return this.deps.lock.withLock(`room:${this.roomId}`, async () => {
      if (!this.state || !this.gameId) {
        return this.reject(envelope.actionId, 'BAD_REQUEST', 'game not started');
      }

      const member = this.members.get(userId);
      if (!member || member.isSpectator || member.seat === null) {
        return this.reject(envelope.actionId, 'FORBIDDEN', 'not a seated player');
      }

      if (envelope.action.seat !== member.seat) {
        return this.reject(envelope.actionId, 'FORBIDDEN', 'seat mismatch');
      }

      const dedup = await this.deps.actionDedup.check(this.gameId, envelope.actionId);
      if (dedup.result === 'DUPLICATE') {
        return { status: 'DUPLICATE', actionId: envelope.actionId, seq: dedup.seq ?? this.eventSeq };
      }

      const prevState = this.state;
      const fromSeq = this.eventSeq;

      let nextState: GameState;
      let events: GameEvent[];
      try {
        ({ state: nextState, events } = this.deps.engine.reduce(prevState, envelope.action));
      } catch (err) {
        const legal = getLegalActions(prevState);
        if (err instanceof EngineError) {
          return {
            status: 'REJECTED',
            actionId: envelope.actionId,
            error: { code: 'BAD_REQUEST', message: err.message },
            legalActions: legal,
          };
        }
        throw err;
      }

      if (events.length === 0) {
        return this.reject(envelope.actionId, 'BAD_REQUEST', 'no events produced');
      }

      // ── EventStore FIRST — state commit only on success ──
      let toSeq: number;
      try {
        toSeq = await this.appendEvents(events);
      } catch {
        return this.reject(
          envelope.actionId,
          'INTERNAL',
          'event persistence failed; state not updated',
        );
      }

      // ── Commit in-memory state AFTER durable append ──
      this.state = nextState;
      this.eventSeq = toSeq;

      await this.deps.actionDedup.record(this.gameId, envelope.actionId, toSeq);
      await this.maybeSnapshot();
    this.broadcastDiffs(fromSeq, toSeq, events);
    this.maybeEmitDecision(nextState, toSeq);
    this.maybeEmitPlayingDeclarations(nextState, toSeq);
      if (nextState.phase === 'FINISHED') {
        this.status = 'FINISHED';
        this.broadcastGameEnded(events);
      } else {
        this.scheduleAiTurn();
      }

      return { status: 'APPLIED', actionId: envelope.actionId, seq: toSeq };
    });
  }

  /** Reconnect/resume from a client-held seq cursor. */
  resume(request: ResumeRequest, userId: string): ResumeResult {
    if (!this.state || !this.gameId) return { status: 'NOT_FOUND' };

    const member = this.members.get(userId);
    if (!member) return { status: 'NOT_FOUND' };

    if (this.state.phase === 'FINISHED') {
      return { status: 'ENDED', result: this.buildGameResult() };
    }

    if (request.lastSeq === this.eventSeq) {
      const sync = this.buildSyncFor(userId);
      if (!sync) return { status: 'NOT_FOUND' };
      return { status: 'SYNC', sync };
    }

    const batches = this.diffBatches.filter((b) => b.toSeq > request.lastSeq);
    const diffs: StateDiffMsg[] = [];
    let expected = request.lastSeq;
    for (const batch of batches) {
      if (batch.fromSeq !== expected) break;
      const diff = batch.bySocket[member.socketId];
      if (!diff) break;
      diffs.push(diff);
      expected = batch.toSeq;
    }

    if (diffs.length > 0 && expected === this.eventSeq) {
      return { status: 'DIFF', diffs };
    }

    const sync = this.buildSyncFor(userId);
    if (!sync) return { status: 'NOT_FOUND' };
    return { status: 'SYNC', sync };
  }

  private async tryStartGame(): Promise<GameSyncMsg | undefined> {
    if (this.state !== null) return undefined;
    const seated = [...this.members.values()].filter((m) => !m.isSpectator);
    if (seated.length < 2) return undefined;
    if (!seated.every((m) => m.ready)) return undefined;

    return this.deps.lock.withLock(`room:${this.roomId}`, async () => {
      if (this.state !== null) return undefined;

      const gameId = randomUUID();
      const seed =
        process.env.GOSTOP_E2E_SEED ??
        this.deps.seedFactory?.(this.roomId) ??
        `${this.roomId}:${Date.now()}`;
      const players = seated
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
        .map((m) => ({
          seat: m.seat!,
          playerId: m.userId,
          isAi: m.isAi === true,
        }));

      const { state, events } = this.deps.engine.createGame({
        gameId,
        seed,
        players,
        preset: 'PMANG_NEWMATGO',
      });

      this.gameId = gameId;
      try {
        this.eventSeq = await this.appendEvents(events, -1);
      } catch {
        this.gameId = null;
        throw new Error('genesis event persistence failed');
      }

      this.state = state;
      this.status = 'IN_PROGRESS';
      await this.maybeSnapshot();

      const fromSeq = -1;
      this.broadcastDiffs(fromSeq, this.eventSeq, events);
      this.emitRoomState();
      this.maybeEmitPlayingDeclarations(state, this.eventSeq);

      if (state.phase === 'FINISHED') {
        this.status = 'FINISHED';
        this.broadcastGameEnded(events);
      } else {
        this.scheduleAiTurn();
      }

      return this.buildSyncFor(players[0]!.playerId);
    });
  }

  /** Append events starting at `eventSeq + 1`. Returns the new latest seq. */
  private async appendEvents(events: readonly GameEvent[], baseSeq = this.eventSeq): Promise<number> {
    if (!this.gameId) throw new Error('no gameId');
    const startSeq = baseSeq + 1;
    const entries = events.map((event, i) => ({ seq: startSeq + i, event }));
    await this.deps.eventStore.append(this.gameId, entries);
    return startSeq + events.length - 1;
  }

  private async maybeSnapshot(): Promise<void> {
    if (!this.gameId || !this.state || this.eventSeq < 0) return;
    const interval = this.deps.snapshotInterval ?? SNAPSHOT_INTERVAL;
    if ((this.eventSeq + 1) % interval !== 0) return;

    await this.deps.snapshotStore.save({
      gameId: this.gameId,
      seq: this.eventSeq,
      state: this.state,
      stateHash: hashState(this.state),
      phase: this.state.phase,
    });
  }

  private broadcastDiffs(fromSeq: number, toSeq: number, events: readonly GameEvent[]): void {
    if (!this.state) return;
    const recipients = [...this.members.values()]
      .filter((m) => m.connected)
      .map((m) => ({
        socketId: m.socketId,
        seat: m.seat,
        isSpectator: m.isSpectator,
      }));

    const diffs = buildStateDiffs(this.state, fromSeq, toSeq, events, recipients);
    const bySocket: Record<string, StateDiffMsg> = {};
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i]!;
      const diff = diffs[i]!;
      bySocket[r.socketId] = diff;
      this.deps.broadcaster.emitToSocket(r.socketId, 'game:diff', diff);
    }

    this.diffBatches.push({ fromSeq, toSeq, bySocket });
    if (this.diffBatches.length > DIFF_HISTORY_LIMIT) {
      this.diffBatches.shift();
    }
  }

  private maybeEmitDecision(state: GameState, seq: number): void {
    if (!state.pending || state.phase !== 'AWAITING_DECISION') return;
    const seat = state.pending.seat;
    const member = [...this.members.values()].find((m) => m.seat === seat && m.connected);
    if (!member || member.seat === null || member.isAi) return;

    const view = projectView(state, member.seat);
    this.deps.broadcaster.emitToSocket(member.socketId, 'game:decision', {
      gameId: state.gameId,
      seq,
      decision: view.pending ?? state.pending,
      legalActions: getLegalActions(state),
    });
  }

  /** Notify the active human seat of optional PLAYING declarations (흔들기 / 폭탄). */
  private maybeEmitPlayingDeclarations(state: GameState, seq: number): void {
    if (state.phase !== 'PLAYING' || state.pending) return;

    const seat = state.turn;
    for (const member of this.members.values()) {
      if (!member.connected || member.isSpectator || member.seat !== seat || member.isAi) continue;

      const legal = getLegalActions(state).filter(
        (a) => a.type === 'DECLARE_SHAKE' || a.type === 'PLAY_BOMB',
      );
      this.deps.broadcaster.emitToSocket(member.socketId, 'game:decision', {
        gameId: state.gameId,
        seq,
        legalActions: legal,
      });
    }
  }

  private broadcastGameEnded(events: readonly GameEvent[]): void {
    const ended = events.find((e) => e.type === 'GameEnded');
    if (!ended || ended.type !== 'GameEnded') return;

    const breakdowns: ScoreBreakdown[] = events
      .filter((e): e is Extract<GameEvent, { type: 'ScoreEvaluated' }> => e.type === 'ScoreEvaluated')
      .map((e) => e.breakdown);

    const result: GameResultMsg = {
      gameId: this.gameId!,
      winner: ended.winner,
      finalScore: ended.score,
      settlement: ended.settlement,
      breakdowns,
    };

    for (const m of this.members.values()) {
      if (m.connected) {
        this.deps.broadcaster.emitToSocket(m.socketId, 'game:ended', result);
      }
    }
  }

  private buildSyncFor(userId: string): GameSyncMsg | undefined {
    if (!this.state) return undefined;
    const member = this.members.get(userId);
    if (!member) return undefined;

    const view =
      member.isSpectator || member.seat === null
        ? projectSpectatorView(this.state)
        : projectPlayerView(this.state, member.seat);

    return {
      gameId: this.state.gameId,
      seq: this.eventSeq,
      view,
      stateHash: hashState(this.state),
    };
  }

  private buildGameResult(): GameResultMsg {
    if (!this.state || !this.gameId) {
      throw new Error('no game');
    }
    return {
      gameId: this.gameId,
      winner: this.state.winner ?? null,
      finalScore: this.state.finalScore ?? 0,
      settlement: [],
      breakdowns: [],
    };
  }

  private roomStateMsg(): RoomStateMsg {
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      mode: 'PMANG_NEWMATGO',
      status: this.status,
      hostUserId: [...this.members.values()][0]?.userId ?? '',
      stake: '0',
      members: [...this.members.values()].map((m) => ({
        user: { userId: m.userId, nickname: m.nickname },
        seat: m.seat,
        isAi: m.isAi === true,
        isSpectator: m.isSpectator,
        connected: m.connected,
        ready: m.ready,
      })),
      spectatorCount: [...this.members.values()].filter((m) => m.isSpectator).length,
    };
  }

  private emitRoomState(): void {
    this.deps.broadcaster.emitToRoom(this.roomId, 'room:state', this.roomStateMsg());
  }

  private reject(actionId: string, code: ApiError['code'], message: string): ActionAck {
    const legal = this.state ? getLegalActions(this.state) : [];
    return {
      status: 'REJECTED',
      actionId,
      error: { code, message },
      legalActions: legal,
    };
  }

  /** Clear ended game so solo rematch / rejoin can deal a fresh hand. */
  private resetForNewGame(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    this.gameId = null;
    this.state = null;
    this.eventSeq = -1;
    this.status = 'WAITING';
    this.diffBatches.length = 0;
    this.aiBusy = false;

    if (this.soloMode) {
      const human = [...this.members.values()].find((m) => !m.isSpectator && !m.isAi);
      if (human) human.ready = true;
      const ai = this.getAiMember();
      if (ai) ai.ready = true;
    }
  }

  private ensureAiOpponent(): void {
    if ([...this.members.values()].some((m) => m.isAi)) return;
    this.members.set(AI_BOT_ID, {
      userId: AI_BOT_ID,
      socketId: '',
      nickname: AI_BOT_NICKNAME,
      seat: 1,
      isSpectator: false,
      ready: true,
      connected: true,
      isAi: true,
    });
  }

  private getAiMember(): RoomMember | undefined {
    return [...this.members.values()].find((m) => m.isAi === true);
  }

  private scheduleAiTurn(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (!this.state || this.state.phase === 'FINISHED') return;

    const ai = this.getAiMember();
    if (!ai || ai.seat === null) return;

    const legal = getLegalActions(this.state);
    if (legal.length === 0) return;
    if (legal[0]!.seat !== ai.seat) return;

    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      void this.runAiTurn();
    }, 850);
  }

  private async runAiTurn(): Promise<void> {
    if (this.aiBusy || !this.state || !this.gameId) return;
    const ai = this.getAiMember();
    if (!ai || ai.seat === null) return;

    const legal = getLegalActions(this.state);
    if (legal.length === 0 || legal[0]!.seat !== ai.seat) return;

    this.aiBusy = true;
    try {
      const view = projectView(this.state, ai.seat);
      const action = decide(view, legal, 'normal');
      await this.handleAction(
        { gameId: this.gameId, actionId: randomUUID(), action },
        ai.userId,
      );
    } finally {
      this.aiBusy = false;
    }
  }
}
