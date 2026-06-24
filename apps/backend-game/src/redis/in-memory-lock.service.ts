import type { LockService } from './lock.service.js';

/** Single-process lock for tests and dev without Redis. */
export class InMemoryLockService implements LockService {
  private readonly held = new Set<string>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.held.has(key)) {
      throw new Error(`lock busy: ${key}`);
    }
    this.held.add(key);
    try {
      return await fn();
    } finally {
      this.held.delete(key);
    }
  }
}
