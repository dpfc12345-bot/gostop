/**
 * Shared HTTP contract primitives.
 *
 * An ApiEndpoint is a typed descriptor — method + path + the request/response
 * shapes — so client and server share ONE definition. The server implements it,
 * the client calls it, and TypeScript keeps both honest.
 *
 *   const res = await http(RankingRoutes.list, { query: { mode: 'PMANG_NEWMATGO' } });
 *
 * Everything here is transport-agnostic (no NestJS/Express); the apps wire these
 * descriptors to controllers and fetch clients in step 10.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * The request surface of an endpoint. Path params are always strings (they come
 * from the URL); query is flattened primitives; body is JSON.
 */
export interface RequestShape {
  params?: Record<string, string>;
  /** Flattened query primitives; precise shape lives on each endpoint's TReq. */
  query?: object;
  body?: unknown;
}

/** A fully-typed endpoint descriptor shared by client and server. */
export interface ApiEndpoint<TReq extends RequestShape, TRes> {
  readonly method: HttpMethod;
  /** Express/NestJS-style path with `:param` placeholders. */
  readonly path: string;
  /** Auth requirement, for client UX and server guard wiring. */
  readonly auth: 'NONE' | 'USER' | 'ADMIN';
  /** Phantom types — never read at runtime, only used for inference. */
  readonly _req?: TReq;
  readonly _res?: TRes;
}

export function defineEndpoint<TReq extends RequestShape, TRes>(
  method: HttpMethod,
  path: string,
  auth: ApiEndpoint<TReq, TRes>['auth'] = 'USER',
): ApiEndpoint<TReq, TRes> {
  return { method, path, auth };
}

export type EndpointReq<E> = E extends ApiEndpoint<infer R, unknown> ? R : never;
export type EndpointRes<E> = E extends ApiEndpoint<RequestShape, infer R> ? R : never;

/**
 * Money is stored as BigInt (smallest unit) server-side; over JSON it travels as
 * a base-10 integer STRING to avoid float/Number precision loss on large balances.
 */
export type MoneyAmount = string;

/** Stable machine-readable error codes shared across services. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_FUNDS'
  | 'IDEMPOTENCY_REPLAY'
  | 'VALIDATION_FAILED'
  | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /** Field-level validation issues or extra context. */
  details?: unknown;
}

/** Uniform error envelope for non-2xx responses. */
export interface ApiErrorResponse {
  error: ApiError;
}

/** Cursor-based pagination query (scales past OFFSET on large tables). */
export interface CursorQuery {
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
  /** Page size (server clamps to a max). */
  limit?: number;
}

/** A page of results. `nextCursor` is absent on the last page. */
export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
  /** Optional total (only when cheap to compute). */
  total?: number;
}

/** Minimal public user descriptor embedded in many responses. */
export interface PublicUser {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
}
