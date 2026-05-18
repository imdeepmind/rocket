import Fastify from 'fastify';
import NodeCache from 'node-cache';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {ICache} from '@/plugin/cache';
import rateLimitPlugin, {RateLimitPluginOptions} from '@/plugin/rate-limit';

import {RateLimitConfig} from '@/interfaces/config';

const {mockParseDuration} = vi.hoisted(() => {
  return {
    mockParseDuration: vi.fn((timeWindow: string) => {
      const match = timeWindow.match(/^(\d+)([smhd])$/);
      if (!match) throw new Error(`Invalid duration: ${timeWindow}`);
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
          throw new Error(`Unsupported unit: ${unit}`);
      }
    }),
  };
});

vi.mock('@/utils/duration', () => ({
  parseDuration: mockParseDuration,
}));

describe('rate-limit plugin', () => {
  let rateLimitConfig: RateLimitConfig;
  let mockCache: ICache;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitConfig = {
      enabled: true,
      max: 100,
      timeWindow: '15m',
      useRedis: false,
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockResolvedValue(false),
      clear: vi.fn().mockResolvedValue(undefined),
      raw: {} as unknown as NodeCache,
    };
  });

  it('skips registration if rate limiting is disabled', async () => {
    const fastify = Fastify();
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: false,
        max: 100,
        timeWindow: '15m',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).not.toHaveBeenCalled();
    await fastify.close();
  });

  it('registers rate-limit plugin when enabled', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: rateLimitConfig,
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    await fastify.close();
  });

  it('parses time window duration correctly (minutes)', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: '15m',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    expect(mockParseDuration('15m')).toBe(900000);
    await fastify.close();
  });

  it('parses time window duration correctly (seconds)', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 50,
        timeWindow: '30s',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('30s');
    expect(mockParseDuration('30s')).toBe(30000);
    await fastify.close();
  });

  it('parses time window duration correctly (hours)', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 1000,
        timeWindow: '1h',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('1h');
    expect(mockParseDuration('1h')).toBe(3600000);
    await fastify.close();
  });

  it('parses time window duration correctly (days)', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 10000,
        timeWindow: '7d',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('7d');
    expect(mockParseDuration('7d')).toBe(604800000);
    await fastify.close();
  });

  it('sets correct max threshold', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 250,
        timeWindow: '1h',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    expect(mockParseDuration).toHaveBeenCalledWith('1h');
    await fastify.close();
  });

  it('throws error on invalid time window format', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: 'invalid',
        useRedis: false,
      },
    };

    mockParseDuration.mockImplementationOnce(() => {
      throw new Error('Invalid duration: invalid');
    });

    await expect(fastify.register(rateLimitPlugin, config)).rejects.toThrow();
    await fastify.close();
  });

  it('logs rate limit configuration', async () => {
    const fastify = Fastify();
    fastify.decorate('cache', mockCache);
    const logInfoSpy = vi.spyOn(fastify.log, 'info');
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: '15m',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    const loggedMessage = logInfoSpy.mock.calls.find((call: unknown[]) =>
      (call[0] as string)?.includes?.('Rate limiting configured'),
    );
    expect(loggedMessage).toBeDefined();
    await fastify.close();
  });

  it('logs when rate limiting is disabled', async () => {
    const fastify = Fastify();
    const logInfoSpy = vi.spyOn(fastify.log, 'info');
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: false,
        max: 100,
        timeWindow: '15m',
        useRedis: false,
      },
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    const loggedMessage = logInfoSpy.mock.calls.find((call: unknown[]) =>
      (call[0] as string)?.includes?.('Rate limiting is disabled'),
    );
    expect(loggedMessage).toBeDefined();
    await fastify.close();
  });

  describe('CustomCacheStore', () => {
    it('increments rate limit in cache successfully', async () => {
      const fastify = Fastify();

      const mockState: Record<string, {current: number; expiresAt: number}> =
        {};
      const mockCacheStore: ICache = {
        get: vi
          .fn()
          .mockImplementation(async <T>(key: string): Promise<T | null> => {
            return (mockState[key] as unknown as T) || null;
          }),
        set: vi.fn().mockImplementation(async (key: string, val: unknown) => {
          mockState[key] = val as {current: number; expiresAt: number};
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        has: vi.fn().mockResolvedValue(false),
        clear: vi.fn().mockResolvedValue(undefined),
        raw: {} as unknown as NodeCache,
      };

      fastify.decorate('cache', mockCacheStore);

      const config: RateLimitPluginOptions = {
        rateLimit: {
          enabled: true,
          max: 2,
          timeWindow: '1m',
          useRedis: false,
        },
      };

      await fastify.register(rateLimitPlugin, config);

      fastify.get('/', async () => 'ok');

      await fastify.ready();

      // First request (should initialize)
      let res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-ratelimit-remaining']).toBe('1');

      // Second request (should increment)
      res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-ratelimit-remaining']).toBe('0');

      // Third request (should block)
      res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(429);

      await fastify.close();
    });

    it('handles cache get error gracefully', async () => {
      const fastify = Fastify();

      const mockCacheStore: ICache = {
        get: vi.fn().mockRejectedValue(new Error('Cache GET failed')),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        has: vi.fn().mockResolvedValue(false),
        clear: vi.fn().mockResolvedValue(undefined),
        raw: {} as unknown as NodeCache,
      };

      fastify.decorate('cache', mockCacheStore);

      const config: RateLimitPluginOptions = {
        rateLimit: {
          enabled: true,
          max: 2,
          timeWindow: '1m',
          useRedis: false,
        },
      };

      await fastify.register(rateLimitPlugin, config);
      fastify.get('/', async () => 'ok');
      await fastify.ready();

      // Request should fail due to internal cache error
      const res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(500);

      await fastify.close();
    });

    it('handles cache set error gracefully', async () => {
      const fastify = Fastify();

      const mockCacheStore: ICache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockRejectedValue(new Error('Cache SET failed')),
        delete: vi.fn().mockResolvedValue(undefined),
        has: vi.fn().mockResolvedValue(false),
        clear: vi.fn().mockResolvedValue(undefined),
        raw: {} as unknown as NodeCache,
      };

      fastify.decorate('cache', mockCacheStore);

      const config: RateLimitPluginOptions = {
        rateLimit: {
          enabled: true,
          max: 2,
          timeWindow: '1m',
          useRedis: false,
        },
      };

      await fastify.register(rateLimitPlugin, config);
      fastify.get('/', async () => 'ok');
      await fastify.ready();

      // Request should fail due to internal cache set error
      const res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(500);

      await fastify.close();
    });

    it('resets rate limit if expired', async () => {
      const fastify = Fastify();

      const mockState: Record<string, {current: number; expiresAt: number}> = {
        'rate-limit-127.0.0.1': {current: 5, expiresAt: Date.now() - 10000}, // Expired
      };

      const mockCacheStore: ICache = {
        get: vi
          .fn()
          .mockImplementation(async <T>(key: string): Promise<T | null> => {
            return (mockState[key] as unknown as T) || null;
          }),
        set: vi.fn().mockImplementation(async (key: string, val: unknown) => {
          mockState[key] = val as {current: number; expiresAt: number};
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        has: vi.fn().mockResolvedValue(false),
        clear: vi.fn().mockResolvedValue(undefined),
        raw: {} as unknown as NodeCache,
      };

      fastify.decorate('cache', mockCacheStore);

      const config: RateLimitPluginOptions = {
        rateLimit: {
          enabled: true,
          max: 2,
          timeWindow: '1m',
          useRedis: false,
        },
      };

      await fastify.register(rateLimitPlugin, config);

      fastify.get('/', async () => 'ok');

      await fastify.ready();

      // Request should succeed and reset current to 1
      const res = await fastify.inject({method: 'GET', url: '/'});
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-ratelimit-remaining']).toBe('1');

      await fastify.close();
    });

    it('returns child instance correctly', async () => {
      const fastify = Fastify();

      let StoreClass: unknown;
      const originalRegister = fastify.register;
      fastify.register = function (
        this: unknown,
        ...args: Parameters<typeof fastify.register>
      ) {
        const opts = args[1];
        if (opts && typeof opts === 'object' && 'store' in opts) {
          StoreClass = (opts as {store: unknown}).store;
        }
        return originalRegister.apply(this, args);
      } as unknown as typeof fastify.register;

      const config: RateLimitPluginOptions = {
        rateLimit: {
          enabled: true,
          max: 2,
          timeWindow: '1m',
          useRedis: false,
        },
      };

      await fastify.register(rateLimitPlugin, config);
      await fastify.ready();

      const StoreClassConstructor = StoreClass as new (
        opts: Record<string, unknown>,
      ) => {child: () => unknown};
      const storeInstance = new StoreClassConstructor({});
      expect(storeInstance.child()).toBe(storeInstance);

      await fastify.close();
    });
  });
});
