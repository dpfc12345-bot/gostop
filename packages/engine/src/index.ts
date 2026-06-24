/**
 * @gostop/engine — public entrypoint.
 *
 * The engine is a PURE library: given a game state and an action it returns the
 * next state plus the domain events that occurred. It never performs I/O, never
 * reads wall-clock time or global randomness directly, and knows nothing about
 * NestJS, React, Socket.IO, Prisma or Redis.
 *
 *   reduce(state, action) -> { state, events }
 *
 * This guarantees: server authority, full determinism (seed-replayable),
 * trivial unit testing, and identical behaviour on server / web / mobile / AI.
 *
 * NOTE: This is the step-2 structural skeleton. Concrete implementations of the
 * domain objects (Card, Deck, Player, Board, GameState, TurnManager,
 * ScoreCalculator, RuleEngine, GameEngine) land in step 5 onward.
 */

export const ENGINE_VERSION = '0.0.0';

export * from './domain/index.js';
export * from './state/index.js';
export * from './events/index.js';
export * from './rules/index.js';
export * from './scoring/index.js';
export * from './rng/index.js';
export * from './engine/index.js';
