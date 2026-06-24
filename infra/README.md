# infra

## Local development

```bash
docker compose -f infra/docker-compose.yml up -d   # Postgres + Redis
cp .env.example .env
pnpm install
pnpm dev
```

## Production topology (AWS)

```
            Web / Mobile browser
                    │
              CloudFront (CDN, static assets: web & admin)
                    │
              ALB (L7, HTTPS, WS upgrade, sticky sessions)
            ┌───────┴────────────┐
            ▼                    ▼
   ECS Fargate service    ECS Fargate service
     backend-api            backend-game
   (stateless, scales      (sticky WS, scales
    on RPS/CPU)             on connections)
            └───────┬────────────┘
              ┌──────┴───────┐
              ▼              ▼
   ElastiCache Redis    RDS PostgreSQL
   (cache, pub/sub,     (Prisma; primary +
    Socket.IO adapter,   read replicas)
    matchmaking queue)
```

- **Two Fargate services** so API and game tiers scale and fail independently.
- **Redis Pub/Sub + Socket.IO Redis adapter** lets any game node broadcast to
  players connected to any other node → true multi-instance horizontal scaling.
- **Event Sourcing** game logs live in PostgreSQL (append-only), enabling
  100% replay for the admin console, CS, and anti-cheat.

## Planned files (step 10 / deployment)

```
infra/
├── docker-compose.yml          # local Postgres + Redis (this file)
├── docker/
│   ├── backend-api.Dockerfile  # multi-stage pnpm build
│   └── backend-game.Dockerfile
└── aws/                        # IaC (ECS task defs, ALB, RDS, ElastiCache)
```
