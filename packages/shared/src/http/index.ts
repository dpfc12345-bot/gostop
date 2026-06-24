/**
 * REST DTO + endpoint contract (step 8).
 *
 * One typed ApiEndpoint per route, shared by client and server:
 *   - game.ts    : (4) event-log query, (1) replay, (3) state-hash verification,
 *                  (2) admin integrity verification, game records
 *   - ranking.ts : (5) leaderboards & rating history (ELO + Glicko-2)
 *   - friend.ts  : (6) friends, requests, invites
 *   - wallet.ts  : (7) wallets + ledger (idempotent, BigInt-as-string)
 */
export * from './common.js';
export * from './enums.js';
export * from './game.js';
export * from './ranking.js';
export * from './friend.js';
export * from './wallet.js';
