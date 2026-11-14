import {CacheOptions, ICache} from '@/interfaces/cache';
import {ResolvedAppConfig, ResolvedCacheConfig} from '@/interfaces/config';

import {createMemcacheCache} from './memcache';
import {createMemoryCache} from './memory';
import {createRedisCache} from './redis';

/**
 * Create the cache backend selected by `infrastructure.cache.engine`.
 */
export function createCache(
  config: ResolvedCacheConfig,
  options: CacheOptions = {},
): ICache {
  switch (config.engine) {
    case 'memory':
      return createMemoryCache(options);
    case 'redis':
      return createRedisCache(config, options);
    case 'memcached':
      return createMemcacheCache(config, options);
    default:
      // Unreachable at runtime when the config schema has been validated;
      // kept as a fail-fast guard for programmatic config construction.
      throw new Error(
        `Unsupported cache engine: ${(config as {engine: string}).engine}`,
      );
  }
}

/**
 * Whether the configured cache is shared across server instances.
 */
export function isDistributedCacheConfigured(
  config: ResolvedAppConfig,
): boolean {
  const engine = config.infrastructure.cache.engine;
  return engine === 'redis' || engine === 'memcached';
}
