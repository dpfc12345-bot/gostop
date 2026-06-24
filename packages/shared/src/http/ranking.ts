/**
 * (5) Ranking API.
 *
 * Backed by the Rating / RatingHistory / Season models. Designed to serve BOTH
 * ELO and Glicko-2 leaderboards (the client picks `system`); Glicko-2 adds the
 * `rd`/`volatility` fields, which are null for ELO.
 */
import {
  defineEndpoint,
  type CursorQuery,
  type Paginated,
  type PublicUser,
} from './common.js';
import type { GameMode, RatingSystem } from './enums.js';

export interface RankingEntryDto {
  rank: number;
  user: PublicUser;
  rating: number;
  /** Glicko-2 only. */
  rd?: number | null;
  volatility?: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0..1 (wins / gamesPlayed); 0 when unplayed. */
  winRate: number;
}

export interface RankingQuery extends CursorQuery {
  mode: GameMode;
  system: RatingSystem;
  /** Season key (e.g. "2026-S1"); omitted = all-time/current. */
  seasonKey?: string;
}

export interface MyRankingDto {
  entry: RankingEntryDto;
  /** Top percentile, 0..1 (0 = best). */
  percentile: number;
  /** Total ranked players in this board (for "X / N"). */
  totalRanked: number;
}

export interface RatingDetailDto {
  user: PublicUser;
  mode: GameMode;
  system: RatingSystem;
  rating: number;
  rd?: number | null;
  volatility?: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastGameAt?: string | null;
}

export interface RatingHistoryEntryDto {
  gameId?: string | null;
  seasonKey?: string | null;
  ratingBefore: number;
  ratingAfter: number;
  rdBefore?: number | null;
  rdAfter?: number | null;
  occurredAt: string;
}

export interface RatingHistoryQuery extends CursorQuery {
  mode: GameMode;
  system: RatingSystem;
  seasonKey?: string;
}

export const RankingRoutes = {
  /** Leaderboard page. */
  list: defineEndpoint<{ query: RankingQuery }, Paginated<RankingEntryDto>>(
    'GET',
    '/rankings',
    'NONE',
  ),

  /** The caller's own rank + percentile. */
  me: defineEndpoint<
    { query: { mode: GameMode; system: RatingSystem; seasonKey?: string } },
    MyRankingDto
  >('GET', '/rankings/me'),

  /** A user's current rating for a (mode, system). */
  userRating: defineEndpoint<
    { params: { userId: string }; query: { mode: GameMode; system: RatingSystem } },
    RatingDetailDto
  >('GET', '/users/:userId/rating', 'NONE'),

  /** A user's per-game rating history. */
  userRatingHistory: defineEndpoint<
    { params: { userId: string }; query: RatingHistoryQuery },
    Paginated<RatingHistoryEntryDto>
  >('GET', '/users/:userId/rating-history', 'NONE'),
} as const;

export type RankingRouteset = typeof RankingRoutes;
