/**
 * Encode a value before handing it to a cache backend.
 *
 * Every engine stores strings, so values are serialized as JSON. This keeps
 * `get`/`set` behavior consistent across memory, Redis and Memcached.
 */
export declare function encodeCacheValue(value: unknown): string;
/**
 * Decode a cached value.
 *
 * Missing values resolve to `null`. Data that is not valid JSON is returned
 * as-is for backwards compatibility with entries written by older versions.
 */
export declare function decodeCacheValue<T>(raw: string | Buffer | null | undefined): T | null;
