# @gostop/web — Player client

React + Vite + Tailwind. Connects to `backend-game` via Socket.IO.

## Dev (two players)

Terminal 1 — game server:

```bash
pnpm --filter @gostop/backend-game build
pnpm --filter @gostop/backend-game start
```

Terminal 2 — web client:

```bash
pnpm --filter @gostop/web dev
```

Open http://localhost:5173 in two browser windows (or one normal + one incognito). Log in with different User IDs, create/join the **same room ID**, both click **준비**, then play.

## Architecture

- **PlayerView only** on the game table — never `GameState`
- Actions are intents only (`game:action` + `actionId`)
- Dev panel: Event Inspector, Replay Viewer, State Hash, Resume & Spectator tests
