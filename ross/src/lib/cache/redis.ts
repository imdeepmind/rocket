import Redis from 'ioredis';

import {CacheOptions, ICache} from '@/interfaces/cache';
import {ResolvedCacheConfig} from '@/interfaces/config';

import {decodeCacheValue, encodeCacheValue} from './codec';

type RedisCacheConfig = Extract<ResolvedCacheConfig, {engine: 'redis'}>;

/**
 * Create a Redis-backed cache.
 */
export function createRedisCache(
  config: RedisCacheConfig,
  options: CacheOptions = {},
): ICache {
  const {logger} = options;

  const redis = new Redis(config.connection.url, {
    connectTimeout: config.timeout,
    retryStrategy: times => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
  });

  redis.on('error', err => {
    logger?.error(`Redis connection error: ${err.message}`);
  });

  redis.on('connect', () => {
    logger?.info('Redis connection established');
  });

  redis.on('ready', () => {
    logger?.info('Redis client ready');
  });

  return {
    async get<T>(key: string) {
      return decodeCacheValue<T>(await redis.get(key));
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      const encoded = encodeCacheValue(value);

      if (ttlSeconds) {
        await redis.set(key, encoded, 'EX', ttlSeconds);
      } else {
        await redis.set(key, encoded);
      }
    },
    async delete(key: string) {
      await redis.del(key);
    },
    async has(key: string) {
      const exists = await redis.exists(key);
      return exists > 0;
    },
    async clear() {
      await redis.flushdb();
    },
    async ping() {
      await redis.ping();
    },
    async close() {
      logger?.info('Closing Redis connection...');
      await redis.quit();
      logger?.info('Redis connection closed.');
    },
    raw: redis,
  };
}
