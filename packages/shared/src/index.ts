/**
 * @gostop/shared — cross-boundary contracts.
 *
 * Keeps client and servers type-synchronised from one place. Holds:
 *   - socket/  : Socket.IO event names + payload types (client<->backend-game)
 *   - http/    : REST request/response DTOs (client<->backend-api)
 *   - schemas/ : zod schemas for runtime validation (parse at every boundary)
 *
 * Transport-agnostic: no NestJS/React/Socket.IO runtime imports here.
 */
export * from './socket/index.js';
export * from './http/index.js';
export * from './schemas/index.js';
