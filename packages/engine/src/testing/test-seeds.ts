/**
 * E2E / QA seed catalog — deterministic deals that surface special rules.
 *
 * Used by automated integration tests and manual browser sessions
 * (`GOSTOP_E2E_SEED=<seed>` on backend-game).
 */
import { createGame, getLegalActions, reduce } from '../engine/reduce.js';
import { createSeededRng } from '../rng/rng.js';
import type { GameEvent } from '../events/events.js';

const PLAYERS = [
  { seat: 0 as const, playerId: 'A', isAi: false },
  { seat: 1 as const, playerId: 'B', isAi: false },
];

/** Tags for seeds that trigger or favour special-rule paths. */
export type TestSeedTag =
  | 'playable'
  | 'chongtong'
  | 'shake-offer'
  | 'bomb-offer'
  | 'go-or-stop'
  | 'ppeok'
  | 'ttakdak'
  | 'jjok'
  | 'ssak-sseuli'
  | 'showdown';

export interface TestSeedEntry {
  seed: string;
  tags: TestSeedTag[];
}

const EVENT_TO_TAG: Partial<Record<GameEvent['type'], TestSeedTag>> = {
  ChongtongDeclared: 'chongtong',
  ShakeDeclared: 'shake-offer',
  BombDeclared: 'bomb-offer',
  PpeokOccurred: 'ppeok',
  ShowdownOccurred: 'showdown',
  GoStopRequired: 'go-or-stop',
};

function collectEventTags(event: GameEvent, tags: Set<TestSeedTag>): void {
  const direct = EVENT_TO_TAG[event.type];
  if (direct) tags.add(direct);
  if (event.type === 'JunkStolen') {
    if (event.cause === 'JJOK') tags.add('jjok');
    if (event.cause === 'TTAKDAK') tags.add('ttakdak');
    if (event.cause === 'SSAKSSEULI') tags.add('ssak-sseuli');
  }
}

function tagsFromGenesis(seed: string): TestSeedTag[] {
  const { state, events } = createGame({ gameId: 'scan', seed, players: PLAYERS });
  const tags = new Set<TestSeedTag>();

  for (const event of events) {
    collectEventTags(event, tags);
  }

  if (tags.has('chongtong')) return [...tags];

  tags.add('playable');
  for (const action of getLegalActions(state)) {
    if (action.type === 'DECLARE_SHAKE') tags.add('shake-offer');
    if (action.type === 'PLAY_BOMB') tags.add('bomb-offer');
  }
  return [...tags];
}

/** Play a biased random game to discover in-play special events for a seed. */
function tagsFromProbePlay(seed: string, maxSteps = 400): TestSeedTag[] {
  const tags = new Set<TestSeedTag>(tagsFromGenesis(seed));
  if (tags.has('chongtong')) return [...tags];

  const rng = createSeededRng(`probe:${seed}`);
  let state = createGame({ gameId: 'scan', seed, players: PLAYERS }).state;

  for (let step = 0; state.phase !== 'FINISHED' && step < maxSteps; step++) {
    if (state.pending?.kind === 'GO_OR_STOP') tags.add('go-or-stop');

    const legal = getLegalActions(state);
    const preferred = [
      'DECLARE_SHAKE',
      'PLAY_BOMB',
      'CHOOSE_MATCH',
      'PLAY_CARD',
      'DECLARE_STOP',
      'DECLARE_GO',
    ] as const;
    const action =
      preferred.map((t) => legal.find((a) => a.type === t)).find(Boolean) ??
      legal[rng.nextInt(legal.length)]!;

    const result = reduce(state, action);
    for (const event of result.events) {
      collectEventTags(event, tags);
    }
    state = result.state;
  }
  return [...tags];
}

export interface DiscoverTestSeedsOptions {
  /** How many `e2e-N` seeds to scan (default 1500). */
  scanLimit?: number;
  /** Run biased play probe on each non-chongtong seed (slower, richer tags). */
  probePlay?: boolean;
}

/** Scan deterministic seeds and classify special-rule coverage. */
export function discoverTestSeeds(options: DiscoverTestSeedsOptions = {}): TestSeedEntry[] {
  const scanLimit = options.scanLimit ?? 1500;
  const probePlay = options.probePlay ?? false;
  const out: TestSeedEntry[] = [];

  for (let i = 0; i < scanLimit; i++) {
    const seed = `e2e-${i}`;
    const tags = probePlay ? tagsFromProbePlay(seed) : tagsFromGenesis(seed);
    out.push({ seed, tags });
  }
  return out;
}

export interface E2ESeedCatalog {
  /** ≥10 playable seeds (no instant 총통 end). */
  playableSeeds: string[];
  /** One representative seed per special tag (when found). */
  byTag: Partial<Record<TestSeedTag, string>>;
  /** Full entries for tooling / DevPanel. */
  entries: TestSeedEntry[];
}

function pickBest(entries: TestSeedEntry[], tag: TestSeedTag): string | undefined {
  return entries.find((e) => e.tags.includes(tag))?.seed;
}

let catalogCache: E2ESeedCatalog | null = null;

/**
 * Build (and memoize) a catalog for automated E2E runs.
 * Fast path: genesis-only scan; still finds chongtong / shake / bomb offers.
 */
export function getE2ESeedCatalog(forceRefresh = false): E2ESeedCatalog {
  if (catalogCache && !forceRefresh) return catalogCache;

  const entries = discoverTestSeeds({ scanLimit: 2000, probePlay: true });
  const playableSeeds = entries
    .filter((e) => e.tags.includes('playable') && !e.tags.includes('chongtong'))
    .map((e) => e.seed)
    .slice(0, 15);

  if (playableSeeds.length < 10) {
    throw new Error(`E2E catalog: need ≥10 playable seeds, got ${playableSeeds.length}`);
  }

  const byTag: Partial<Record<TestSeedTag, string>> = {};
  for (const tag of [
    'chongtong',
    'shake-offer',
    'bomb-offer',
    'go-or-stop',
    'ppeok',
    'ttakdak',
    'jjok',
    'ssak-sseuli',
    'showdown',
  ] as const) {
    const seed = pickBest(entries, tag);
    if (seed) byTag[tag] = seed;
  }

  catalogCache = { playableSeeds, byTag, entries };
  return catalogCache;
}

/** Curated list for manual browser sessions (high special-rule density). */
export function getManualBrowserSeeds(): { seed: string; purpose: string }[] {
  const { playableSeeds, byTag } = getE2ESeedCatalog();
  const rows: { seed: string; purpose: string }[] = playableSeeds
    .slice(0, 10)
    .map((seed, i) => ({ seed, purpose: `일반 플레이 검증 #${i + 1}` }));

  for (const [tag, seed] of Object.entries(byTag)) {
    if (seed && tag !== 'playable') {
      rows.push({ seed, purpose: `특수 규칙: ${tag}` });
    }
  }
  return rows;
}
