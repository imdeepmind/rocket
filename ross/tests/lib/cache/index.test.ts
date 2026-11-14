import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createCache, isDistributedCacheConfigured} from '@/lib/cache';
import {createMemcacheCache} from '@/lib/cache/memcache';
import {createMemoryCache} from '@/lib/cache/memory';
import {createRedisCache} from '@/lib/cache/redis';

import {ResolvedAppConfig, ResolvedCacheConfig} from '@/interfaces/config';

vi.mock('@/lib/cache/memory', () => ({createMemoryCache: vi.fn()}));
vi.mock('@/lib/cache/redis', () => ({createRedisCache: vi.fn()}));
vi.mock('@/lib/cache/memcache', () => ({createMemcacheCache: vi.fn()}));

describe('createCache', () => {
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    clear: vi.fn(),
    ping: vi.fn(),
    close: vi.fn(),
    raw: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createMemoryCache).mockReturnValue(cache);
    vi.mocked(createRedisCache).mockReturnValue(cache);
    vi.mocked(createMemcacheCache).mockReturnValue(cache);
  });

  it('creates a memory cache', () => {
    const config: ResolvedCacheConfig = {engine: 'memory'};
    const options = {logger: {info: vi.fn(), error: vi.fn()}};

    expect(createCache(config, options)).toBe(cache);
    expect(createMemoryCache).toHaveBeenCalledWith(options);
    expect(createRedisCache).not.toHaveBeenCalled();
    expect(createMemcacheCache).not.toHaveBeenCalled();
  });

  it('creates a redis cache with the resolved connection', () => {
    const config: ResolvedCacheConfig = {
      engine: 'redis',
      connection: {url: 'redis://localhost:6379'},
      timeout: 5000,
    };
    const options = {logger: {info: vi.fn(), error: vi.fn()}};

    expect(createCache(config, options)).toBe(cache);
    expect(createRedisCache).toHaveBeenCalledWith(config, options);
    expect(createMemoryCache).not.toHaveBeenCalled();
    expect(createMemcacheCache).not.toHaveBeenCalled();
  });

  it('creates a memcached cache with the resolved connection', () => {
    const config: ResolvedCacheConfig = {
      engine: 'memcached',
      connection: {url: 'localhost:11211'},
      timeout: 5000,
    };
    const options = {logger: {info: vi.fn(), error: vi.fn()}};

    expect(createCache(config, options)).toBe(cache);
    expect(createMemcacheCache).toHaveBeenCalledWith(config, options);
    expect(createMemoryCache).not.toHaveBeenCalled();
    expect(createRedisCache).not.toHaveBeenCalled();
  });

  it('throws for an unsupported engine', () => {
    const config = {engine: 'valkey'} as unknown as ResolvedCacheConfig;

    expect(() => createCache(config)).toThrow(
      'Unsupported cache engine: valkey',
    );
  });
});

describe('isDistributedCacheConfigured', () => {
  function buildConfig(cache: ResolvedCacheConfig): ResolvedAppConfig {
    return {
      infrastructure: {cache},
    } as ResolvedAppConfig;
  }

  it('returns false for memory', () => {
    expect(isDistributedCacheConfigured(buildConfig({engine: 'memory'}))).toBe(
      false,
    );
  });

  it('returns true for redis', () => {
    expect(
      isDistributedCacheConfigured(
        buildConfig({
          engine: 'redis',
          connection: {url: 'redis://localhost:6379'},
          timeout: 5000,
        }),
      ),
    ).toBe(true);
  });

  it('returns true for memcached', () => {
    expect(
      isDistributedCacheConfigured(
        buildConfig({
          engine: 'memcached',
          connection: {url: 'localhost:11211'},
          timeout: 5000,
        }),
      ),
    ).toBe(true);
  });
});
