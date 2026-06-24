/**
 * Runtime schema for a player's GameAction — the single most security-critical
 * boundary (Action-Only / Server-Authoritative client).
 *
 * The server parses every inbound action with this schema BEFORE touching the
 * engine, so malformed or hostile payloads never reach game logic. A
 * compile-time proof at the bottom guarantees this schema and the engine's
 * `GameAction` union stay byte-for-byte identical.
 */
import { z } from 'zod';
import type { GameAction } from '@gostop/engine';
import { cardIdSchema, monthSchema, seatSchema } from './common.js';

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLAY_CARD'), seat: seatSchema, cardId: cardIdSchema }),
  z.object({ type: z.literal('CHOOSE_MATCH'), seat: seatSchema, targetCardId: cardIdSchema }),
  z.object({ type: z.literal('DECLARE_SHAKE'), seat: seatSchema, month: monthSchema }),
  z.object({
    type: z.literal('PLAY_BOMB'),
    seat: seatSchema,
    month: monthSchema,
    cardIds: z.array(cardIdSchema).min(1),
  }),
  z.object({ type: z.literal('CHOOSE_KUKJIN'), seat: seatSchema, asDoubleJunk: z.boolean() }),
  z.object({ type: z.literal('DECLARE_GO'), seat: seatSchema }),
  z.object({ type: z.literal('DECLARE_STOP'), seat: seatSchema }),
]);

export type GameActionInput = z.infer<typeof gameActionSchema>;

// ── Compile-time proof: schema output ≡ engine GameAction (both directions). ──
// This fails to compile if the zod schema and the engine union ever diverge.
type AssertAssignable<A extends B, B> = A;
export type ActionSchemaParity = [
  AssertAssignable<GameActionInput, GameAction>,
  AssertAssignable<GameAction, GameActionInput>,
];
