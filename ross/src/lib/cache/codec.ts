/**
 * Encode a value before handing it to a cache backend.
 *
 * Every engine stores strings, so values are serialized as JSON. This keeps
 * `get`/`set` behavior consistent across memory, Redis and Memcached.
 */
export function encodeCacheValue(value: unknown): string {
  const encoded = JSON.stringify(value);

  if (encoded === undefined) {
    throw new Error('Cannot cache a value that is not JSON-serializable');
  }

  return encoded;
}

/**
 * Decode a cached value.
 *
 * Missing values resolve to `null`. Data that is not valid JSON is returned
 * as-is for backwards compatibility with entries written by older versions.
 */
export function decodeCacheValue<T>(
  raw: string | Buffer | null | undefined,
): T | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const text = Buffer.isBuffer(raw) ? raw.toString() : raw;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
