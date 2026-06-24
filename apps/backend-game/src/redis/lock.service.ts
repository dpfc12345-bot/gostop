export interface LockService {
  /** Run `fn` while holding an exclusive lock on `key`. */
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}
