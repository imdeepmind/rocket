import NodeCache from 'node-cache';
import { decodeCacheValue, encodeCacheValue } from './codec.js';
/**
 * Create an in-process cache backed by node-cache.
 */
export function createMemoryCache(options = {}) {
    const { logger } = options;
    const nodeCache = new NodeCache();
    logger?.info('Using node-cache for caching');
    return {
        async get(key) {
            return decodeCacheValue(nodeCache.get(key));
        },
        async set(key, value, ttlSeconds) {
            const encoded = encodeCacheValue(value);
            if (ttlSeconds) {
                nodeCache.set(key, encoded, ttlSeconds);
            }
            else {
                nodeCache.set(key, encoded);
            }
        },
        async delete(key) {
            nodeCache.del(key);
        },
        async has(key) {
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
//# sourceMappingURL=memory.js.map