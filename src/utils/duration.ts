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
export function parseDuration(timeWindow: string): number {
  const match = timeWindow.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(
      `Invalid duration format: "${timeWindow}". Expected format: "<number><unit>" where unit is s, m, h, or d (e.g., '5m', '1h', '30s')`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported duration unit: "${unit}"`);
  }
}
