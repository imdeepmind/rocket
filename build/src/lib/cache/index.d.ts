import { CacheOptions, ICache } from '../../interfaces/cache.js';
import { ResolvedAppConfig, ResolvedCacheConfig } from '../../interfaces/config.js';
/**
 * Create the cache backend selected by `infrastructure.cache.engine`.
 */
export declare function createCache(config: ResolvedCacheConfig, options?: CacheOptions): ICache;
/**
 * Whether the configured cache is shared across server instances.
 */
export declare function isDistributedCacheConfigured(config: ResolvedAppConfig): boolean;
