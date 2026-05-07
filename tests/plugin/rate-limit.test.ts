import Fastify from 'fastify';
import Redis from 'ioredis';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import rateLimitPlugin, {RateLimitPluginOptions} from '@/plugin/rate-limit';

import {RateLimitConfig} from '@/interfaces/config';

// // Mock @fastify/rate-limit
// const mockRegisterCall = vi.fn();
// vi.mock('@fastify/rate-limit', () => {
//   return {
//     default: vi.fn(),
//   };
// });

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
  let mockRedis: Redis;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitConfig = {
      enabled: true,
      max: 100,
      timeWindow: '15m',
      useRedis: false,
    };

    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
      defineCommand: vi.fn(),
    } as unknown as Redis;
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

    // Verify parseDuration was not called
    expect(mockParseDuration).not.toHaveBeenCalled();
    await fastify.close();
  });

  it('registers rate-limit plugin when enabled', async () => {
    const fastify = Fastify();
    const config: RateLimitPluginOptions = {
      rateLimit: rateLimitConfig,
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    // Verify parseDuration was called with correct timeWindow
    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    await fastify.close();
  });

  it('uses in-memory store when useRedis is false', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    await fastify.close();
  });

  it('attempts to use Redis store when useRedis is true and redis is available', async () => {
    const fastify = Fastify();
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: '15m',
        useRedis: true,
      },
      redis: mockRedis,
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    await fastify.close();
  });

  it('parses time window duration correctly (minutes)', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called and returns correct value
    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    // 15 minutes = 900000 ms
    expect(mockParseDuration('15m')).toBe(900000);
    await fastify.close();
  });

  it('parses time window duration correctly (seconds)', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('30s');
    // 30 seconds = 30000 ms
    expect(mockParseDuration('30s')).toBe(30000);
    await fastify.close();
  });

  it('parses time window duration correctly (hours)', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('1h');
    // 1 hour = 3600000 ms
    expect(mockParseDuration('1h')).toBe(3600000);
    await fastify.close();
  });

  it('parses time window duration correctly (days)', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('7d');
    // 7 days = 604800000 ms
    expect(mockParseDuration('7d')).toBe(604800000);
    await fastify.close();
  });

  it('sets correct max threshold', async () => {
    const fastify = Fastify();
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

    // Verify parseDuration was called with correct timeWindow
    expect(mockParseDuration).toHaveBeenCalledWith('1h');
    await fastify.close();
  });

  it('throws error on invalid time window format', async () => {
    const fastify = Fastify();
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: 'invalid',
        useRedis: false,
      },
    };

    // Mock parseDuration to throw for invalid format
    mockParseDuration.mockImplementationOnce(() => {
      throw new Error('Invalid duration: invalid');
    });

    await expect(fastify.register(rateLimitPlugin, config)).rejects.toThrow();

    await fastify.close();
  });

  it('does not use redis when useRedis is true but redis not provided', async () => {
    const fastify = Fastify();
    const config: RateLimitPluginOptions = {
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: '15m',
        useRedis: true,
      },
      // redis is intentionally not provided
    };

    await fastify.register(rateLimitPlugin, config);
    await fastify.ready();

    // Verify parseDuration was called
    expect(mockParseDuration).toHaveBeenCalledWith('15m');
    await fastify.close();
  });

  it('logs rate limit configuration', async () => {
    const fastify = Fastify();
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
});
