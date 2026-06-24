import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { LOCK_TTL_MS } from '../config/constants.js';
import type { LockService } from './lock.service.js';

/** Redis SET NX PX distributed lock with token-safe release. */
export class RedisLockService implements LockService {
  constructor(private readonly redis: Redis) {}

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const lockKey = `gostop:lock:${key}`;
    const acquired = await this.redis.set(lockKey, token, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      throw new Error(`lock busy: ${key}`);
    }
    try {
      return await fn();
    } finally {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end`;
      await this.redis.eval(script, 1, lockKey, token);
    }
  }
}
