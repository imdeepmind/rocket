/**
 * Parses a duration string and returns the duration in milliseconds.
 * Supported formats:
 *   - 's' for seconds (e.g., '30s' = 30000ms)
 *   - 'm' for minutes (e.g., '5m' = 300000ms)
 *   - 'h' for hours (e.g., '1h' = 3600000ms)
 *   - 'd' for days (e.g., '1d' = 86400000ms)
 *
 * @param timeWindow - A duration string in the format "<number><unit>" (e.g., '5m', '1h', '30s')
 * @returns The duration in milliseconds
 * @throws Error if the format is invalid or unit is unsupported
 */
export declare function parseDuration(timeWindow: string): number;
