import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import cachePlugin from '@/plugin/cache';

import {createCache} from '@/lib/cache';
import {resolveConfig} from '@/lib/config/resolve';

import {ICache} from '@/interfaces/cache';

vi.mock('@/lib/cache', () => ({
  createCache: vi.fn(),
}));

function createCacheMock(): ICache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    clear: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    raw: {},
  };
}

describe('cache plugin', () => {
  let app: FastifyInstance;
  let cache: ICache;

  beforeEach(() => {
    vi.clearAllMocks();

    cache = createCacheMock();
    vi.mocked(createCache).mockReturnValue(cache);
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.close();
      } catch {
        // The ping-failure test leaves the instance unready.
      }
    }
  });

  function createApp(): FastifyInstance {
    const fastify = Fastify();
    fastify.appConfig = resolveConfig(
      {application: {name: 'test'}, data: {models: {}}},
      {mode: 'dev'},
    );
    return fastify;
  }

  it('creates, pings and decorates the configured cache', async () => {
    app = createApp();

    await app.register(cachePlugin);
    await app.ready();

    expect(createCache).toHaveBeenCalledWith(
      {engine: 'memory'},
      {logger: app.log},
    );
    expect(cache.ping).toHaveBeenCalledTimes(1);
    expect(app.hasDecorator('cache')).toBe(true);
    expect(app.cache).toBe(cache);
  });

  it('closes the cache when the application shuts down', async () => {
    app = createApp();

    await app.register(cachePlugin);
    await app.ready();
    await app.close();

    expect(cache.close).toHaveBeenCalled();
  });

  it('closes the cache and fails startup when the ping fails', async () => {
    vi.mocked(cache.ping).mockRejectedValueOnce(
      new Error('Cache is unavailable'),
    );
    app = createApp();

    await expect(app.register(cachePlugin)).rejects.toThrow(
      'Cache is unavailable',
    );
    expect(cache.close).toHaveBeenCalledTimes(1);
  });

  it('surfaces the ping error even when cleanup also fails', async () => {
    vi.mocked(cache.ping).mockRejectedValueOnce(
      new Error('Cache is unavailable'),
    );
    vi.mocked(cache.close).mockRejectedValueOnce(new Error('close failed'));
    app = createApp();

    await expect(app.register(cachePlugin)).rejects.toThrow(
      'Cache is unavailable',
    );
    expect(cache.close).toHaveBeenCalledTimes(1);
  });
});
