/**
 * Socket.IO contract (step 9): event maps, message payloads, and the Redis
 * Pub/Sub envelope for multi-instance backend-game.
 *
 * Principles wired into the types:
 *   Action-Only client · Server-Authoritative · Spectator views · Reconnect/
 *   Resume · actionId dedup · per-seat StateDiff broadcast · Redis Pub/Sub.
 */
export * from './messages.js';
export * from './events.js';
export * from './pubsub.js';
