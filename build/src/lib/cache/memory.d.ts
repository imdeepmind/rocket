import { CacheOptions, ICache } from '../../interfaces/cache.js';
/**
 * Create an in-process cache backed by node-cache.
 */
export declare function createMemoryCache(options?: CacheOptions): ICache;
