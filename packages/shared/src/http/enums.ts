/**
 * String-literal mirrors of the persisted (Prisma) enums.
 *
 * Re-declared here so the contracts layer stays independent of @gostop/db while
 * remaining wire-compatible with it. Keep these in lockstep with schema.prisma.
 */
export type GameMode = 'PMANG_NEWMATGO' | 'HANGAME_GOSTOP' | 'CLASSIC_GOSTOP' | 'CUSTOM';

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'ABORTED' | 'NAGARI';

export type RatingSystem = 'ELO' | 'GLICKO2';

export type CurrencyType = 'GOLD' | 'RUBY';

export type WalletTxType =
  | 'SIGNUP_BONUS'
  | 'DAILY_REWARD'
  | 'GAME_STAKE'
  | 'GAME_WINNING'
  | 'GAME_REFUND'
  | 'PURCHASE'
  | 'ADMIN_ADJUST'
  | 'TRANSFER';

export type WalletTxStatus = 'PENDING' | 'COMPLETED' | 'REVERSED';

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export type ParticipantResult = 'WIN' | 'LOSE' | 'DRAW';

/** Live presence of a user (hydrated from Redis, not persisted). */
export type FriendPresence = 'OFFLINE' | 'ONLINE' | 'IN_LOBBY' | 'IN_GAME';
