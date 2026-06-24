# admin

Internal admin console (React + Vite). Kept as a **separate app** from `web` so
admin code, bundles, auth, and deployment never mix with the player client.

## Planned layout (step 10)

```
src/
├── app/
├── pages/          # dashboard, users, economy, reports, replay
├── features/
│   └── replay/     # event-log player: rebuilds a game step-by-step via @gostop/engine
├── shared/api/     # admin REST client (@gostop/shared contracts)
└── main.tsx
```

The replay viewer is the payoff of Event Sourcing: a game's append-only event
log replays the match 100% for CS and anti-cheat.
