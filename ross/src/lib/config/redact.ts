import {
  ApiKeyProviderConfig,
  ResolvedAppConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

export const REDACTED = '***';

/**
 * Redact credentials embedded in a connection URL while keeping the scheme,
 * host, port and database path intact.
 *
 *   postgresql://user:pass@host:5432/db → postgresql://***:***@host:5432/db
 *   redis://:pass@host:6379            → redis://***:***@host:6379
 *   redis://host:6379                  → redis://host:6379 (unchanged)
 */
export function redactConnectionUrl(url: string): string {
  const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^@/]*)@(.*)$/);

  if (!match) return url;

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
export function redactConfig(config: ResolvedAppConfig): ResolvedAppConfig {
  const redacted = structuredClone(config);

  const authentication = redacted.authentication;

  if (authentication.enabled && authentication.provider.type === 'up-auth') {
    (authentication.provider.config as UpAuthProviderConfig).jwtSecret =
      REDACTED;
  }

  if (authentication.enabled && authentication.provider.type === 'api-key') {
    (authentication.provider.config as ApiKeyProviderConfig).key = REDACTED;
  }

  const email = redacted.integrations.email;

  if (email?.provider === 'aws-ses' && email.config.secretAccessKey) {
    email.config.secretAccessKey = REDACTED;
  }

  if (email?.provider === 'sendgrid') {
    email.config.apiKey = REDACTED;
  }

  redacted.infrastructure.database.connection.url = redactConnectionUrl(
    redacted.infrastructure.database.connection.url,
  );

  const cache = redacted.infrastructure.cache;

  if (cache.engine === 'redis') {
    cache.connection.url = redactConnectionUrl(cache.connection.url);
  }

  return redacted;
}
