import type { Redis } from 'ioredis';
import { ACTION_DEDUP_TTL_SEC } from '../config/constants.js';

export type DedupResult = 'NEW' | 'DUPLICATE';

export interface ActionDedupService {
  check(gameId: string, actionId: string): Promise<{ result: DedupResult; seq?: number }>;
  record(gameId: string, actionId: string, seq: number): Promise<void>;
}

export class InMemoryActionDedupService implements ActionDedupService {
  private readonly seen = new Map<string, number>();

  private key(gameId: string, actionId: string): string {
    return `${gameId}:${actionId}`;
  }

  async check(gameId: string, actionId: string): Promise<{ result: DedupResult; seq?: number }> {
    const seq = this.seen.get(this.key(gameId, actionId));
    if (seq !== undefined) return { result: 'DUPLICATE', seq };
    return { result: 'NEW' };
  }

  async record(gameId: string, actionId: string, seq: number): Promise<void> {
    this.seen.set(this.key(gameId, actionId), seq);
  }
}

export class RedisActionDedupService implements ActionDedupService {
  constructor(private readonly redis: Redis) {}

  private key(gameId: string, actionId: string): string {
    return `gostop:action:${gameId}:${actionId}`;
  }

  async check(gameId: string, actionId: string): Promise<{ result: DedupResult; seq?: number }> {
    const val = await this.redis.get(this.key(gameId, actionId));
    if (val !== null) return { result: 'DUPLICATE', seq: Number(val) };
    return { result: 'NEW' };
  }

  async record(gameId: string, actionId: string, seq: number): Promise<void> {
    await this.redis.set(this.key(gameId, actionId), String(seq), 'EX', ACTION_DEDUP_TTL_SEC, 'NX');
  }
}
