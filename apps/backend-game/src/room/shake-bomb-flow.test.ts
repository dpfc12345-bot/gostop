/**
 * End-to-end verification: 흔들기 / 폭탄 from engine → RoomActor → EventStore → client wire.
 *
 * Run: pnpm --filter @gostop/backend-game test -- shake-bomb-flow
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createGame,
  getLegalActions,
  reduce,
  resolveRuleConfig,
  type GameAction,
  type CapturedPile,
  type FieldPiles,
  type GameState,
  type PlayerState,
  type Seat,
} from '@gostop/engine';
import { getE2ESeedCatalog } from '@gostop/engine/testing';
import type { CardId } from '@gostop/engine';
import type { DecisionRequestMsg } from '@gostop/shared';
import { createTestRoomManager } from './room-manager.js';

// ── Engine fixtures (same layout as declarations.test.ts) ───────────────────

function player(seat: Seat, hand: CardId[]): PlayerState {
  const captured: CapturedPile = { brights: [], animals: [], ribbons: [], junk: [] };
  return {
    seat,
    playerId: `p${seat}`,
    isAi: false,
    hand: [...hand],
    captured,
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

function makePlayingState(opts: {
  players: PlayerState[];
  field?: FieldPiles;
  turn?: Seat;
}): GameState {
  return {
    gameId: 'fixture',
    seed: 'fixture',
    rule: resolveRuleConfig('PMANG_NEWMATGO'),
    scoreEngineVersion: 1,
    phase: 'PLAYING',
    players: opts.players,
    dealer: 0,
    turn: opts.turn ?? 0,
    turnCount: 1,
    board: { field: opts.field ?? {} },
    drawPile: [],
    stakeMultiplier: 1,
    eventSeq: 0,
  };
}

/** Mirrors DecisionModal — buttons render when these actions exist and it is my turn. */
function uiDeclarationButtons(legal: GameAction[]): GameAction[] {
  return legal.filter((a) => a.type === 'DECLARE_SHAKE' || a.type === 'PLAY_BOMB');
}

function decisionMsgs(
  broadcaster: ReturnType<typeof createTestRoomManager>['broadcaster'],
  socketId: string,
) {
  return broadcaster.messages.filter(
    (m) => m.socketId === socketId && m.event === 'game:decision',
  ) as { payload: DecisionRequestMsg }[];
}


describe('흔들기 — play path verification', () => {
  const shakeState = makePlayingState({
    players: [player(0, [0, 1, 2, 4]), player(1, [5])],
  });

  it('1–4 · engine: 3-of-a-month hand offers DECLARE_SHAKE', () => {
    const legal = getLegalActions(shakeState);
    // eslint-disable-next-line no-console
    console.log('[shake] getLegalActions:', JSON.stringify(legal, null, 2));

    const shake = legal.find((a) => a.type === 'DECLARE_SHAKE');
    expect(shake, 'DECLARE_SHAKE must be legal when 3+ cards of same month in hand').toEqual({
      type: 'DECLARE_SHAKE',
      seat: 0,
      month: 1,
    });
  });

  it('5 · UI filter exposes a 흔들기 button label', () => {
    const legal = getLegalActions(shakeState);
    const buttons = uiDeclarationButtons(legal);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.type).toBe('DECLARE_SHAKE');
  });

  it('6–8 · RoomActor: game:decision → game:action → ShakeDeclared in EventStore', async () => {
    const { manager, broadcaster, eventStore } = createTestRoomManager();
    const room = manager.getOrCreate('shake-fixture');
    const p0 = 'shake-human';
    const p1 = 'shake-opponent';
    const sock0 = 'sock-shake';

    await room.join({ userId: p0, socketId: sock0, nickname: 'P0' });
    await room.join({ userId: p1, socketId: 'sock-p1', nickname: 'P1' });
    await room.setReady(p0, true);
    await room.setReady(p1, true);
    expect(room.gameId).toBeTruthy();

    room.state = { ...shakeState, gameId: room.gameId!, seed: room.state!.seed };
    broadcaster.clear();

    await room.join({ userId: p0, socketId: `${sock0}-wire`, nickname: 'P0' });

    const shake = getLegalActions(room.state!).find((a) => a.type === 'DECLARE_SHAKE')!;
    expect(shake).toBeTruthy();

    const wire = decisionMsgs(broadcaster, `${sock0}-wire`);
    expect(
      wire.some((m) => m.payload.legalActions.some((a) => a.type === 'DECLARE_SHAKE')),
      'game:decision must include DECLARE_SHAKE for the active human',
    ).toBe(true);

    const actionId = randomUUID();
    const ack = await room.handleAction(
      { gameId: room.gameId!, actionId, action: shake },
      p0,
    );
    expect(ack.status).toBe('APPLIED');

    const stored = eventStore.dump(room.gameId!);
    expect(stored.map((e) => e.event.type)).toContain('ShakeDeclared');
  });
});

// ── 폭탄 ─────────────────────────────────────────────────────────────────────

describe('폭탄 — play path verification', () => {
  const bombState = makePlayingState({
    players: [player(0, [1, 2, 3, 4]), player(1, [5])],
    field: { 1: [0] },
  });

  it('1–4 · engine: 3 in hand + 1 on field offers PLAY_BOMB', () => {
    const legal = getLegalActions(bombState);
    // eslint-disable-next-line no-console
    console.log('[bomb] getLegalActions:', JSON.stringify(legal, null, 2));

    const bomb = legal.find((a) => a.type === 'PLAY_BOMB');
    expect(bomb, 'PLAY_BOMB requires exactly 3 same-month cards in hand and ≥1 on field').toEqual({
      type: 'PLAY_BOMB',
      seat: 0,
      month: 1,
      cardIds: [1, 2, 3],
    });
  });

  it('5 · UI filter exposes a 폭탄 button label', () => {
    const legal = getLegalActions(bombState);
    const buttons = uiDeclarationButtons(legal);
    expect(buttons.some((a) => a.type === 'PLAY_BOMB')).toBe(true);
  });

  it('6–8 · RoomActor: game:decision → game:action → BombDeclared in EventStore', async () => {
    const { manager, broadcaster, eventStore } = createTestRoomManager();
    const room = manager.getOrCreate('bomb-fixture');
    const p0 = 'bomb-human';
    const p1 = 'bomb-opponent';
    const sock0 = 'sock-bomb';

    await room.join({ userId: p0, socketId: sock0, nickname: 'P0' });
    await room.join({ userId: p1, socketId: 'sock-p1', nickname: 'P1' });
    await room.setReady(p0, true);
    await room.setReady(p1, true);
    expect(room.gameId).toBeTruthy();

    room.state = { ...bombState, gameId: room.gameId!, seed: room.state!.seed };
    broadcaster.clear();

    await room.join({ userId: p0, socketId: `${sock0}-wire`, nickname: 'P0' });

    const bomb = getLegalActions(room.state!).find((a) => a.type === 'PLAY_BOMB')!;
    expect(bomb).toBeTruthy();

    const wire = decisionMsgs(broadcaster, `${sock0}-wire`);
    expect(
      wire.some((m) => m.payload.legalActions.some((a) => a.type === 'PLAY_BOMB')),
      'game:decision must include PLAY_BOMB for the active human',
    ).toBe(true);

    const actionId = randomUUID();
    const ack = await room.handleAction({ gameId: room.gameId!, actionId, action: bomb }, p0);
    expect(ack.status).toBe('APPLIED');

    const stored = eventStore.dump(room.gameId!);
    expect(stored.map((e) => e.event.type)).toContain('BombDeclared');
  });

  it('engine reduce records BombDeclared from fixture layout', () => {
    const bomb = getLegalActions(bombState).find((a) => a.type === 'PLAY_BOMB')!;
    const { events } = reduce(bombState, bomb);
    expect(events.map((e) => e.type)).toContain('BombDeclared');
  });

  it('catalog bomb-offer seed opens with PLAY_BOMB', () => {
    const seed = getE2ESeedCatalog().byTag['bomb-offer']!;
    const { state } = createGame({
      gameId: 'scan-bomb',
      seed,
      players: [
        { seat: 0, playerId: 'A', isAi: false },
        { seat: 1, playerId: 'B', isAi: false },
      ],
    });
    expect(getLegalActions(state).some((a) => a.type === 'PLAY_BOMB')).toBe(true);
  });
});
