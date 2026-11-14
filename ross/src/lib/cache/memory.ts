import NodeCache from 'node-cache';

import {CacheOptions, ICache} from '@/interfaces/cache';

import {decodeCacheValue, encodeCacheValue} from './codec';

/**
 * Create an in-process cache backed by node-cache.
 */
export function createMemoryCache(options: CacheOptions = {}): ICache {
  const {logger} = options;
  const nodeCache = new NodeCache();

  logger?.info('Using node-cache for caching');

  return {
    async get<T>(key: string) {
      return decodeCacheValue<T>(nodeCache.get<string>(key));
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      const encoded = encodeCacheValue(value);

      if (ttlSeconds) {
        nodeCache.set(key, encoded, ttlSeconds);
      } else {
        nodeCache.set(key, encoded);
      }
    },
    async delete(key: string) {
      nodeCache.del(key);
    },
    async has(key: string) {
      return nodeCache.has(key);
    },
    async clear() {
      nodeCache.flushAll();
    },
    async ping() {
      const probeKey = '__healthcheck_probe__';
      nodeCache.set(probeKey, 1, 1);
      nodeCache.del(probeKey);
    },
    async close() {
      logger?.info('Closing node-cache...');
      nodeCache.close();
      logger?.info('node-cache closed.');
    },
    raw: nodeCache,
  };
}
