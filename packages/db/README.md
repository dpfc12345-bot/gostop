# @gostop/db

Single source of truth for the PostgreSQL schema (Prisma) and the generated
client. Consumed by `backend-api` (auth/member/ranking/admin) and `backend-game`
(append-only event writes).

## Commands

```bash
# from repo root
pnpm --filter @gostop/db db:generate    # generate client into ./generated/prisma
pnpm --filter @gostop/db db:migrate      # create + apply a dev migration
pnpm --filter @gostop/db db:deploy       # apply migrations (prod/CI)
pnpm --filter @gostop/db db:validate     # validate schema
pnpm --filter @gostop/db db:studio       # browse data
```

`DATABASE_URL` must be set (see root `.env.example`).

## Conventions

- **Common columns on every model**: `createdAt`, `updatedAt`, `deletedAt`.
- **Soft delete**: `deletedAt = NULL` means a live row. A Prisma Client
  extension (added in step 10) rewrites `find*`/`delete*` to filter
  `deletedAt: null` and turn deletes into `deletedAt = now()`. Immutable ledgers
  (`game_events`, `wallet_transactions`, `game_snapshots`) keep the column for
  uniformity but are never soft-deleted.
- **Money** is `BigInt` in the smallest unit — never floats.
- **Append-only truth, cached aggregates**: `wallet_transactions` is the ledger;
  `wallets.balance` is a transactional cache. `game_events` is the event store;
  `games.*` outcome fields and `game_snapshots` are derived/optimisations.

## ERD

```mermaid
erDiagram
  User ||--o{ RefreshToken : has
  User ||--o{ Wallet : owns
  Wallet ||--o{ WalletTransaction : ledger
  User ||--o{ WalletTransaction : by
  User ||--o{ FriendRequest : "requester/addressee"
  User ||--o{ Friendship : "owner/target"
  User ||--o{ GameParticipant : plays
  User ||--o{ Rating : has
  User ||--o{ RatingHistory : has
  User ||--o{ ChatMessage : sends
  User ||--o{ Report : "reporter/target"
  User ||--o{ Sanction : "sanctioned/issuer"
  User ||--o{ AdminAuditLog : actor
  User ||--o{ Game : won

  Game ||--o{ GameParticipant : seats
  Game ||--o{ GameEvent : "event store (append-only)"
  Game ||--o{ GameSnapshot : "state snapshots"
  Game ||--o{ ChatMessage : room
  Game ||--o{ Report : about

  Season ||--o{ RatingHistory : scopes

  User {
    string id PK
    string username UK
    string email UK
    string passwordHash
    enum   provider
    enum   role
    enum   status
    bool   isGuest
    string nickname
  }
  Wallet {
    string id PK
    string userId FK
    enum   currency
    bigint balance "cache"
    int    version "optimistic lock"
  }
  WalletTransaction {
    bigint amount "signed"
    bigint balanceAfter
    enum   type
    enum   status
    string idempotencyKey UK
    string refType
    string refId
  }
  Game {
    string id PK
    enum   mode
    enum   status
    string seed
    json   ruleConfig "snapshot"
    int    playerCount
    string winnerUserId FK
  }
  GameParticipant {
    string gameId FK
    string userId FK
    int    seat
    bool   isAi
    enum   result
    int    score
    bigint payout
    enum   ratingSystem
    float  ratingBefore
    float  ratingAfter
  }
  GameEvent {
    bigint id PK "global order"
    string gameId FK
    int    seq "per-game"
    string type
    int    version
    json   payload
  }
  GameSnapshot {
    string gameId FK
    int    seq
    json   state "full GameState"
    string phase
  }
  Rating {
    string userId FK
    enum   mode
    enum   system "ELO|GLICKO2"
    float  rating
    float  rd "Glicko-2"
    float  volatility "Glicko-2"
  }
```

## Replay performance (GameSnapshot)

To reconstruct a game at event `seq = N`:

1. Load the latest `GameSnapshot` where `seq <= N` (or the initial state from `seed`).
2. Apply `GameEvent`s in `(gameId, seq)` order from there to `N`.

Snapshots are written every K events (and at game end), so replay is O(K)
instead of O(total events) — important for the admin replay viewer.
