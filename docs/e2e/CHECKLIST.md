# E2E Test Checklist — Browser (2 players, ≥10 games)

Automated coverage lives in `@gostop/e2e` (`pnpm test:e2e`).  
This checklist is for **manual browser verification** before `backend-api`.

## Prerequisites

```bash
pnpm install
pnpm build
pnpm --filter @gostop/backend-game start   # :3001
pnpm --filter @gostop/web dev              # :5173
```

Open **two browsers** (normal + incognito). Use **different User IDs**.

Optional — force a known deal layout:

```bash
# PowerShell
$env:GOSTOP_E2E_SEED="e2e-42"
pnpm --filter @gostop/backend-game start
```

Seed catalog: `getManualBrowserSeeds()` from `@gostop/engine/testing` (see automated test output).

---

## Per-session checks (every game)

| # | Check | P1 | P2 | Notes |
|---|--------|----|----|-------|
| 1 | Socket status = `connected` (Dev → socket) | ☐ | ☐ | |
| 2 | State Hash visible in header + Dev panel | ☐ | ☐ | Same hash both players |
| 3 | Event Inspector logs `SYNC` / `DIFF` / `ACTION` | ☐ | ☐ | |
| 4 | Only **PlayerView** on table (no raw GameState) | ☐ | ☐ | |
| 5 | Play to **게임 종료** overlay | ☐ | ☐ | |
| 6 | Replay Viewer: scrub frames, events non-empty | ☐ | ☐ | |
| 7 | Resume test: `lastSeq=0` → success | ☐ | ☐ | Dev → resume tab |
| 8 | Winner + score shown on end overlay | ☐ | ☐ | |

---

## 10+ game matrix (use catalog seeds)

Run **10 normal games** + **special-rule spot checks**.

| Game | Seed (set `GOSTOP_E2E_SEED`) | Focus | Done |
|------|------------------------------|-------|------|
| 1 | `e2e-0` (or catalog #1) | Full flow, hash match | ☐ |
| 2 | catalog #2 | Card match / field | ☐ |
| 3 | catalog #3 | Go/Stop decision | ☐ |
| 4 | catalog #4 | Multi-turn | ☐ |
| 5 | catalog #5 | Score display | ☐ |
| 6 | catalog #6 | Replay scrub | ☐ |
| 7 | catalog #7 | Resume mid-game | ☐ |
| 8 | catalog #8 | Disconnect/rejoin same room | ☐ |
| 9 | catalog #9 | Dev panel events | ☐ |
| 10 | catalog #10 | End-to-end settlement | ☐ |
| S1 | `byTag.chongtong` | Instant end, 총통 | ☐ |
| S2 | `byTag.shake-offer` | 흔들기 button | ☐ |
| S3 | `byTag.bomb-offer` | 폭탄 (if offered) | ☐ |
| S4 | `byTag.go-or-stop` | 고/스톱 modal | ☐ |
| S5 | `byTag.ppeok` / `jjok` / `ttakdak` | Special capture (if seen) | ☐ |

Print seeds locally:

```bash
pnpm --filter @gostop/e2e seeds
```

---

## Spectator session (once per E2E run)

| # | Check | Done |
|---|--------|------|
| 1 | Third browser: join room with **관전으로 입장** | ☐ |
| 2 | Navigates to `/game` — no PlayerView table | ☐ |
| 3 | Dev → Spectator tab shows `SpectatorView` JSON | ☐ |
| 4 | Spectator cannot play cards | ☐ |
| 5 | Spectator hash matches players after each action | ☐ |

---

## Automated gate (must pass before backend-api)

```bash
pnpm test:e2e
```

Covers:

- **Replay** — EventStore replay ≡ live state (all catalog playable seeds)
- **Resume** — SYNC/DIFF/ENDED paths
- **Spectator** — view shape + action rejection
- **State Hash** — final broadcast hash ≡ authoritative state
- **Multi-game** — ≥10 full games to `FINISHED`
- **Socket gateway** — real Socket.IO join/ready/resume

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Dev | | | ☐ PASS / ☐ FAIL |
| Notes | | | |

**After PASS** → in order:

1. `PrismaEventStore` 활성화 (prod default)
2. `PrismaSnapshotStore` 활성화 (prod default)
3. Recovery 테스트 — 실제 DB 기반 재검증
4. `backend-api` — Register → Login → Refresh → JWT Guard → Profile → Ranking → Wallet (Ledger SoT) → Friend

InMemory 저장소는 **개발 모드 전용**, 실서비스 기본값은 Prisma.
