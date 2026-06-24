# backend-game

Realtime game server. The **only** place where games actually execute.

Responsibilities: Socket.IO transport, room lifecycle, matchmaking, the
server-authoritative game loop, Event Sourcing persistence, and AI seats.

## Internal layout

```
src/
├── main.ts                 # Nest + Socket.IO bootstrap (step 10)
├── gateway/                # Socket.IO gateways (connection, room, game, chat)
├── game/
│   ├── application/        # GameLoopService: validate -> engine.reduce -> persist -> broadcast
│   ├── room/               # RoomManager (Redis-backed authoritative state)
│   ├── matchmaking/        # queue + distributed locks
│   ├── view/               # per-player view projection (hide opponents' hands)
│   └── events/             # Event Sourcing store (append-only) + replay rebuild
├── ai/                     # AI seat scheduler (wraps @gostop/ai, adds think delays)
└── shared/
    ├── redis/              # ioredis client + pub/sub + Socket.IO Redis adapter
    ├── config/
    └── logger/
```

## Why this is separate from backend-api

Game traffic is sticky, stateful (per connection), latency-sensitive, and scales
on a different axis than stateless REST. Splitting the process lets us scale game
nodes independently and keep an outage in one tier from taking down the other.

> Uses `@gostop/engine` (rules/scoring), `@gostop/ai` (bots), `@gostop/shared`
> (socket contracts). All game decisions are computed server-side via the engine.
