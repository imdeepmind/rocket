export const REDACTED = '***';
/**
 * Redact credentials embedded in a connection URL while keeping the scheme,
 * host, port and database path intact.
 *
 *   postgresql://user:pass@host:5432/db → postgresql://***:***@host:5432/db
 *   redis://:pass@host:6379            → redis://***:***@host:6379
 *   redis://host:6379                  → redis://host:6379 (unchanged)
 */
export function redactConnectionUrl(url) {
    const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^@/]*)@(.*)$/);
    if (!match)
        return url;
    const [, scheme, userinfo, rest] = match;
    const redactedUserinfo = userinfo.includes(':')
        ? `${REDACTED}:${REDACTED}`
        : REDACTED;
    return `${scheme}://${redactedUserinfo}@${rest}`;
}
/**
 * Return a redacted deep copy of a resolved configuration, safe to print.
 *
 * Secrets that are redacted:
 *   - up-auth `jwtSecret`
 *   - api-key `key`
 *   - aws-ses `secretAccessKey`
 *   - sendgrid `apiKey`
 *   - database / cache credentials inside connection URLs
 */
export function redactConfig(config) {
    const redacted = structuredClone(config);
    const authentication = redacted.authentication;
    if (authentication.enabled) {
        if (authentication.jwtSecret) {
            authentication.jwtSecret = REDACTED;
        }
        for (const provider of authentication.providers) {
            if (provider.type === 'api-key') {
                provider.config.key = REDACTED;
            }
            if (provider.type === 'sso') {
                if ('clientSecret' in provider.config) {
                    provider.config.clientSecret = REDACTED;
                }
                if ('cert' in provider.config) {
                    provider.config.cert = REDACTED;
                }
            }
        }
    }
    const email = redacted.integrations.email;
    if (email?.provider === 'aws-ses' && email.config.secretAccessKey) {
        email.config.secretAccessKey = REDACTED;
    }
    if (email?.provider === 'sendgrid') {
        email.config.apiKey = REDACTED;
    }
    redacted.infrastructure.database.connection.url = redactConnectionUrl(redacted.infrastructure.database.connection.url);
    const cache = redacted.infrastructure.cache;
    if (cache.engine === 'redis' || cache.engine === 'memcached') {
        cache.connection.url = redactConnectionUrl(cache.connection.url);
    }
    return redacted;
}
//# sourceMappingURL=redact.js.map