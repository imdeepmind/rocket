const MEMCACHED_SCHEME = /^memcached:\/\//;
function validateMemcachedUrl(url) {
    const errors = [];
    const servers = url.replace(MEMCACHED_SCHEME, '').split(',');
    for (const server of servers) {
        const port = Number(server.split(':').pop());
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            errors.push(`infrastructure.cache: memcached port "${server}" must be between 1 and 65535`);
        }
    }
    return errors;
}
export default function validateCacheDbConstraints(config) {
    const cache = config.infrastructure?.cache;
    if (!cache || cache.engine !== 'memcached') {
        return [];
    }
    const url = cache.connection?.url;
    if (!url) {
        return [];
    }
    return validateMemcachedUrl(url);
}
//# sourceMappingURL=validate-cache-db.js.map