import { ResolvedAppConfig } from '../../interfaces/config.js';
export declare const REDACTED = "***";
/**
 * Redact credentials embedded in a connection URL while keeping the scheme,
 * host, port and database path intact.
 *
 *   postgresql://user:pass@host:5432/db → postgresql://***:***@host:5432/db
 *   redis://:pass@host:6379            → redis://***:***@host:6379
 *   redis://host:6379                  → redis://host:6379 (unchanged)
 */
export declare function redactConnectionUrl(url: string): string;
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
export declare function redactConfig(config: ResolvedAppConfig): ResolvedAppConfig;
