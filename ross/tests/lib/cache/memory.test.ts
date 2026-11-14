import NodeCache from 'node-cache';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createMemoryCache} from '@/lib/cache/memory';

import {CacheLogger} from '@/interfaces/cache';

function createLogger(): CacheLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe('createMemoryCache', () => {
  let logger: CacheLogger;

  beforeEach(() => {
    vi.useRealTimers();
    logger = createLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a node-cache backend and logs it', () => {
    const cache = createMemoryCache({logger});

    expect(cache.raw).toBeInstanceOf(NodeCache);
    expect(logger.info).toHaveBeenCalledWith('Using node-cache for caching');
  });

  it('works without a logger', async () => {
    const cache = createMemoryCache();

    await expect(cache.set('key', 'value')).resolves.toBeUndefined();
    await expect(cache.get('key')).resolves.toBe('value');
    await expect(cache.close()).resolves.toBeUndefined();
  });

  it('performs the full cache lifecycle', async () => {
    const cache = createMemoryCache({logger});

    expect(await cache.get('missing')).toBeNull();

    await cache.set('text', 'value');
    await cache.set('object', {a: 1});
    await cache.set('number', 7);

    expect(await cache.get('text')).toBe('value');
    expect(await cache.get<{a: number}>('object')).toEqual({a: 1});
    expect(await cache.get('number')).toBe(7);
    expect(await cache.has('text')).toBe(true);

    await cache.delete('text');
    expect(await cache.has('text')).toBe(false);

    await cache.clear();
    expect(await cache.get('object')).toBeNull();

    await expect(cache.ping()).resolves.toBeUndefined();
  });

  it('expires keys after the requested TTL', async () => {
    vi.useFakeTimers();
    const cache = createMemoryCache();

    await cache.set('short-lived', 'value', 1);
    expect(await cache.get('short-lived')).toBe('value');

    vi.advanceTimersByTime(1001);

    expect(await cache.get('short-lived')).toBeNull();
  });

  it('closes the node-cache instance and logs it', async () => {
    const cache = createMemoryCache({logger});
    const closeSpy = vi.spyOn(cache.raw as NodeCache, 'close');

    await cache.close();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Closing node-cache...');
    expect(logger.info).toHaveBeenCalledWith('node-cache closed.');
  });
});
