/**
 * Shared zod primitives used to validate every untrusted boundary (HTTP bodies,
 * socket payloads). Types are inferred from schemas so validation and TypeScript
 * never drift.
 */
import { z } from 'zod';

/** cuid/ulid-ish opaque id; kept permissive but non-empty. */
export const idSchema = z.string().min(1).max(64);

/** 0..47 stable card id. */
export const cardIdSchema = z.number().int().min(0).max(47);

/** 0-based seat index. */
export const seatSchema = z.number().int().min(0).max(7);

/** 1..12 month — exact literal union so it matches the engine `Month` type. */
export const monthSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
]);

/** Client-generated action id (uuid v4) used for idempotent de-duplication. */
export const actionIdSchema = z.string().uuid();

/** Positive integer money string in the smallest unit (BigInt-safe). */
export const positiveAmountSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'amount must be a positive integer string');

/** Cursor pagination query. */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type CursorQueryInput = z.infer<typeof cursorQuerySchema>;
