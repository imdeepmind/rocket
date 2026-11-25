import { CacheOptions, ICache } from '../../interfaces/cache.js';
import { ResolvedCacheConfig } from '../../interfaces/config.js';
type MemcachedCacheConfig = Extract<ResolvedCacheConfig, {
    engine: 'memcached';
}>;
/**
 * Create a Memcached-backed cache using memjs.
 *
 * memjs expects timeouts in seconds while the framework config uses
 * milliseconds.
 */
export declare function createMemcacheCache(config: MemcachedCacheConfig, options?: CacheOptions): ICache;
export {};
