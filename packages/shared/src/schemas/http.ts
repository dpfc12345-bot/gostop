/**
 * zod schemas for HTTP request bodies/queries that mutate state or carry
 * untrusted input. Inferred types are compatible with the DTOs in ../http.
 */
import { z } from 'zod';
import { cursorQuerySchema, idSchema, positiveAmountSchema } from './common.js';

const currencySchema = z.enum(['GOLD', 'RUBY']);

/** (7) Wallet transfer — idempotent, positive amount. */
export const transferBodySchema = z.object({
  toUserId: idSchema,
  currency: currencySchema,
  amount: positiveAmountSchema,
  memo: z.string().max(200).optional(),
  idempotencyKey: idSchema,
});

/** (6) Friend request — by id OR username (exactly one required). */
export const createFriendRequestBodySchema = z
  .object({
    addresseeId: idSchema.optional(),
    username: z.string().min(1).max(32).optional(),
    message: z.string().max(200).optional(),
  })
  .refine((b) => Boolean(b.addresseeId) !== Boolean(b.username), {
    message: 'provide exactly one of addresseeId or username',
  });

export const inviteToRoomBodySchema = z.object({ roomId: idSchema });

/** (3) State-hash verification. */
export const verifyHashBodySchema = z.object({
  seq: z.number().int().min(0),
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'expected a 64-char hex SHA-256'),
});

/** (1) Replay seek. */
export const replaySeekBodySchema = z.object({ seq: z.number().int().min(0) });

/** (2) Admin verification options. */
export const verifyGameBodySchema = z.object({
  checkReduceEquivalence: z.boolean().optional(),
});

/** (4) Event-log query. */
export const gameEventQuerySchema = cursorQuerySchema.extend({
  fromSeq: z.coerce.number().int().min(0).optional(),
  toSeq: z.coerce.number().int().min(0).optional(),
  type: z.string().optional(),
});

export type TransferBodyInput = z.infer<typeof transferBodySchema>;
export type CreateFriendRequestBodyInput = z.infer<typeof createFriendRequestBodySchema>;
export type VerifyHashBodyInput = z.infer<typeof verifyHashBodySchema>;
