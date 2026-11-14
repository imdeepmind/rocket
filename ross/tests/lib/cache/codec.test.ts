import {describe, expect, it} from 'vitest';

import {decodeCacheValue, encodeCacheValue} from '@/lib/cache/codec';

describe('cache codec', () => {
  it('encodes objects as JSON', () => {
    expect(encodeCacheValue({a: 1})).toBe('{"a":1}');
  });

  it('encodes strings as quoted JSON so they round-trip unchanged', () => {
    expect(encodeCacheValue('hello')).toBe('"hello"');
    expect(decodeCacheValue<string>('"hello"')).toBe('hello');
  });

  it('encodes numbers and booleans', () => {
    expect(encodeCacheValue(42)).toBe('42');
    expect(encodeCacheValue(false)).toBe('false');
  });

  it('decodes null for missing values', () => {
    expect(decodeCacheValue(null)).toBeNull();
    expect(decodeCacheValue(undefined)).toBeNull();
  });

  it('decodes Buffer values', () => {
    expect(decodeCacheValue<{a: number}>(Buffer.from('{"a":1}'))).toEqual({
      a: 1,
    });
  });

  it('returns non-JSON values as strings', () => {
    expect(decodeCacheValue('not-json')).toBe('not-json');
  });

  it('throws when the value cannot be serialized to JSON', () => {
    expect(() => encodeCacheValue(undefined)).toThrow(
      'Cannot cache a value that is not JSON-serializable',
    );
  });
});
