# backend-api

REST API server. Handles everything **except** live gameplay.

Responsibilities: authentication (signup / login / guest), member profile,
friends, ranking, and the admin API (including game replay retrieval).

## Internal layout (Clean Architecture + DDD)

```
src/
├── main.ts                 # Nest bootstrap (step 10)
├── app.module.ts           # root module (step 10)
├── modules/
│   ├── auth/               # JWT, guest, refresh rotation
│   ├── member/             # profile, currency, friends
│   ├── ranking/            # leaderboards (Redis ZSET + RDS)
│   └── admin/              # admin-only ops, game replay, anti-cheat tooling
│       Each module has:
│         interface/        # controllers, DTOs (zod from @gostop/shared)
│         application/       # use-cases / services
│         domain/            # entities, value objects, repository interfaces
│         infrastructure/    # Prisma repositories, Redis, external adapters
└── shared/
    ├── config/             # env config (@nestjs/config + zod)
    ├── prisma/             # PrismaService + soft-delete extension
    ├── redis/              # Redis client/provider
    └── logger/             # pino logger
```

> Architectural rule (enforced by ESLint): this app must **not** import
> `@gostop/engine` or `@gostop/ai`. Game execution lives in `backend-game`.
> Use `@gostop/shared` for shared types/contracts.
