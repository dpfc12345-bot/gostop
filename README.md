# 고스톱 (Go-Stop) — Online Multiplayer Game Service

Commercial-grade Korean Go-Stop, benchmarked against Hangame 고스톱 and Pmang
뉴맞고. Web + mobile browser. Built as a pnpm + Turborepo monorepo so a single
**pure game engine** is shared by the server, the web client, a future mobile
app, and the AI.

## Monorepo layout

```
gostop/
├── packages/
│   ├── engine/        @gostop/engine  — pure, deterministic, zero-dep game engine
│   ├── shared/        @gostop/shared  — Socket/REST contracts + zod schemas
│   └── ai/            @gostop/ai      — pure AI players (simulate via engine)
├── apps/
│   ├── backend-api/   REST: auth, members, ranking, admin (NestJS)
│   ├── backend-game/  Realtime: Socket.IO, gameplay, rooms, matchmaking (NestJS)
│   ├── web/           Player client (React + Vite + Tailwind)
│   └── admin/         Admin console + replay viewer (React + Vite)
└── infra/             docker-compose (local), AWS topology, Dockerfiles
```

## Dependency direction (enforced by ESLint)

```
apps/*  →  ai  →  shared  →  engine        (engine depends on NOTHING)
```

- `engine` is framework-agnostic and side-effect free: `reduce(state, action)`.
- `backend-api` must **not** import `engine`/`ai` (it never runs games).
- All game logic runs server-side; clients send intents only.

## Getting started

```bash
docker compose -f infra/docker-compose.yml up -d
cp .env.example .env
pnpm install
pnpm build       # turbo: builds packages in dependency order
pnpm typecheck
pnpm lint
pnpm test
```

## Key architectural decisions

| Decision | Why |
| --- | --- |
| Pure engine package | Server authority, determinism, replay, reuse on web/mobile/AI |
| API / game server split | Independent scaling & failure isolation |
| Redis Pub/Sub + Socket.IO adapter | Multi-instance horizontal scale-out |
| Event Sourcing | 100% game replay for CS / anti-cheat |
| Prisma + soft delete + base timestamps | Migration-based ops, auditable data |
| ECS Fargate behind ALB + CloudFront | Commercial deploy without k8s overhead |

> Built step-by-step: (1) architecture → (2) folder structure → (3) domain model
> → (4) ERD → (5) engine → (6) rules → (7) scoring → (8) API → (9) socket events
> → (10) implementation.
