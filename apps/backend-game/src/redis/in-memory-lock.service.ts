import type { LockService } from './lock.service.js';

/** Single-process lock for tests and dev without Redis. */
export class InMemoryLockService implements LockService {
  private readonly held = new Set<string>();

  async withLock<T>(key: string, fn: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    const retryDelayMs = 20;

    while (this.held.has(key)) {
      if (Date.now() >= deadline) {
        throw new Error(`lock timeout: ${key}`);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    }

    this.held.add(key);
    try {
      return await fn();
    } finally {
      this.held.delete(key);
    }
  }
}
