/**
 * (7) Wallet API.
 *
 * The WalletTransaction ledger is the source of truth; `Wallet.balance` is a
 * cache equal to SUM(amount). All amounts are integer STRINGS in the smallest
 * unit (BigInt-safe over JSON). Mutating endpoints require an `idempotencyKey`
 * so a retried request can never double-spend (maps to the unique ledger column).
 */
import {
  defineEndpoint,
  type CursorQuery,
  type MoneyAmount,
  type Paginated,
} from './common.js';
import type { CurrencyType, WalletTxStatus, WalletTxType } from './enums.js';

export interface WalletDto {
  currency: CurrencyType;
  /** Cached balance == SUM(ledger.amount). */
  balance: MoneyAmount;
  updatedAt: string;
}

export interface WalletTransactionDto {
  id: string;
  currency: CurrencyType;
  type: WalletTxType;
  status: WalletTxStatus;
  /** Signed (credit > 0, debit < 0), smallest unit. */
  amount: MoneyAmount;
  /** Running balance immediately after this row. */
  balanceAfter: MoneyAmount;
  refType?: string | null;
  refId?: string | null;
  memo?: string | null;
  createdAt: string;
}

export interface WalletTxQuery extends CursorQuery {
  type?: WalletTxType;
}

export interface TransferBody {
  toUserId: string;
  currency: CurrencyType;
  /** Positive integer string, smallest unit. */
  amount: MoneyAmount;
  memo?: string;
  /** Required: guarantees exactly-once application across retries. */
  idempotencyKey: string;
}

export interface TransferResultDto {
  /** The debit row on the sender's ledger. */
  transaction: WalletTransactionDto;
  /** Sender's balance after the transfer. */
  balance: MoneyAmount;
}

export interface ClaimDailyResultDto {
  claimed: boolean;
  reward?: WalletTransactionDto;
  /** ISO time the next daily reward becomes available. */
  nextClaimAt: string;
}

export const WalletRoutes = {
  /** All wallets for the caller (one per currency). */
  list: defineEndpoint<Record<string, never>, WalletDto[]>('GET', '/wallets'),

  /** A single currency wallet. */
  get: defineEndpoint<{ params: { currency: string } }, WalletDto>(
    'GET',
    '/wallets/:currency',
  ),

  /** Per-wallet ledger history. */
  transactions: defineEndpoint<
    { params: { currency: string }; query: WalletTxQuery },
    Paginated<WalletTransactionDto>
  >('GET', '/wallets/:currency/transactions'),

  /** Peer-to-peer transfer (idempotent). */
  transfer: defineEndpoint<{ body: TransferBody }, TransferResultDto>(
    'POST',
    '/wallets/transfer',
  ),

  /** Claim the daily reward. */
  claimDaily: defineEndpoint<Record<string, never>, ClaimDailyResultDto>(
    'POST',
    '/wallets/claim-daily',
  ),
} as const;

export type WalletRouteset = typeof WalletRoutes;
