/**
 * Domain primitives of Hwatu / Go-Stop.
 *
 *   - card/ : Card value object + the canonical 48-card deck table (this step)
 *
 * Board/Player runtime state lives under `state/` (GameState), since in this
 * engine state is data reduced by pure functions rather than mutable objects.
 */
export * from './card/index.js';
