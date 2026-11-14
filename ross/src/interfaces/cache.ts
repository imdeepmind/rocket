/**
 * Unified cache contract implemented by every cache backend.
 */
export interface ICache {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
  raw: unknown;
}

export interface CacheLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface CacheOptions {
  logger?: CacheLogger;
}
