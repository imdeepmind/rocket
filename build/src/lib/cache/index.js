import { createMemcacheCache } from './memcache.js';
import { createMemoryCache } from './memory.js';
import { createRedisCache } from './redis.js';
/**
 * Create the cache backend selected by `infrastructure.cache.engine`.
 */
export function createCache(config, options = {}) {
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
            throw new Error(`Unsupported cache engine: ${config.engine}`);
    }
}
/**
 * Whether the configured cache is shared across server instances.
 */
export function isDistributedCacheConfigured(config) {
    const engine = config.infrastructure.cache.engine;
    return engine === 'redis' || engine === 'memcached';
}
//# sourceMappingURL=index.js.map