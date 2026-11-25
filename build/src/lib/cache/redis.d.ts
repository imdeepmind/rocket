import { CacheOptions, ICache } from '../../interfaces/cache.js';
import { ResolvedCacheConfig } from '../../interfaces/config.js';
type RedisCacheConfig = Extract<ResolvedCacheConfig, {
    engine: 'redis';
}>;
/**
 * Create a Redis-backed cache.
 */
export declare function createRedisCache(config: RedisCacheConfig, options?: CacheOptions): ICache;
export {};
