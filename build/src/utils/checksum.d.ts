/**
 * Computes a SHA-256 checksum over content after normalizing CRLF (\r\n) line
 * endings to LF (\n) to ensure cross-platform consistency.
 */
export declare function computeChecksum(content: string): string;
