/**
 * zod schemas for inbound socket payloads (validated before the engine runs).
 */
import { z } from 'zod';
import { actionIdSchema, idSchema } from './common.js';
import { gameActionSchema } from './action.js';

/** Client → server: an action intent wrapped for dedup + routing. */
export const actionEnvelopeSchema = z.object({
  gameId: idSchema,
  /** Idempotency key: the server applies each actionId at most once. */
  actionId: actionIdSchema,
  action: gameActionSchema,
});
export type ActionEnvelopeInput = z.infer<typeof actionEnvelopeSchema>;

export const joinRoomSchema = z.object({
  roomId: idSchema,
  /** Join as a non-acting spectator. */
  asSpectator: z.boolean().optional(),
  /** Start a solo match vs AI (single human + bot). */
  solo: z.boolean().optional(),
});

export const resumeRequestSchema = z.object({
  gameId: idSchema,
  /** Highest seq the client has already applied. */
  lastSeq: z.number().int().min(-1),
  asSpectator: z.boolean().optional(),
});

export const chatSendSchema = z.object({
  roomId: idSchema,
  content: z.string().min(1).max(300),
});
