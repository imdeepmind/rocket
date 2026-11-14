import {createHash} from 'crypto';

/**
 * Computes a SHA-256 checksum over content after normalizing CRLF (\r\n) line
 * endings to LF (\n) to ensure cross-platform consistency.
 */
export function computeChecksum(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
