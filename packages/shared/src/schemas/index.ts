/**
 * zod schemas for runtime validation at every trust boundary (HTTP + Socket).
 * Types are inferred from schemas so validation and TypeScript stay in lockstep.
 * A compile-time proof in action.ts pins the action schema to the engine union.
 */
export * from './common.js';
export * from './action.js';
export * from './http.js';
export * from './socket.js';
