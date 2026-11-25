import { Client } from 'memjs';
import { decodeCacheValue, encodeCacheValue } from './codec.js';
/** Remove the optional URI scheme accepted by the config schema. */
function normalizeServers(url) {
    return url.replace(/^memcached:\/\//, '');
}
/**
 * Create a Memcached-backed cache using memjs.
 *
 * memjs expects timeouts in seconds while the framework config uses
 * milliseconds.
 */
export function createMemcacheCache(config, options = {}) {
    const { logger } = options;
    const servers = normalizeServers(config.connection.url);
    const timeoutSeconds = config.timeout / 1000;
    const client = Client.create(servers, {
        timeout: timeoutSeconds,
        conntimeout: timeoutSeconds,
        logger: {
            log: (...args) => {
                logger?.error(`Memcached: ${args.map(String).join(' ')}`);
            },
        },
    });
    logger?.info(`Memcached client created for ${servers}`);
    return {
        async get(key) {
            const { value } = await client.get(key);
            return decodeCacheValue(value);
        },
        async set(key, value, ttlSeconds) {
            const encoded = encodeCacheValue(value);
            if (ttlSeconds) {
                await client.set(key, encoded, { expires: ttlSeconds });
            }
            else {
                await client.set(key, encoded);
            }
        },
        async delete(key) {
            await client.delete(key);
        },
        async has(key) {
            const { value } = await client.get(key);
            return value !== null;
        },
        async clear() {
            await client.flush();
        },
        async ping() {
            await client.get('__healthcheck_probe__');
        },
        async close() {
            logger?.info('Closing Memcached connection...');
            client.quit();
            logger?.info('Memcached connection closed.');
        },
        raw: client,
    };
}
//# sourceMappingURL=memcache.js.map