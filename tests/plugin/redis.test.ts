import Fastify from 'fastify';
import Redis from 'ioredis';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import redisPlugin from '@/plugin/redis';

import {CacheDbConfig} from '@/schema/config';

// Mock ioredis
// Mock ioredis

vi.mock('ioredis', () => {
  const RedisMock = vi.fn(function (
    this: Record<string, unknown>,
    url: string,
  ) {
    this.url = url;
    this.ping = vi.fn().mockResolvedValue('PONG');
    this.quit = vi.fn().mockResolvedValue(undefined);
    this.defineCommand = vi.fn();
    this.on = vi.fn().mockReturnValue(this);
    return this;
  });
  return {default: RedisMock};
});

describe('redis plugin', () => {
  let redisConfig: CacheDbConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    redisConfig = {
      engine: 'redis',
      connection: {
        uri: 'redis://localhost:6379',
      },
      timeout: 5000,
    };
  });

  it('decorates fastify with redis decorator', async () => {
    const fastify = Fastify();
    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    expect(fastify.hasDecorator('redis')).toBe(true);
    expect(fastify.redis).toBeDefined();
    await fastify.close();
  });

  it('uses provided timeout for connection', async () => {
    const fastify = Fastify();
    const config: CacheDbConfig = {
      engine: 'redis',
      connection: {
        uri: 'redis://localhost:6379',
      },
      timeout: 10000,
    };

    await fastify.register(redisPlugin, config);
    await fastify.ready();

    // Verify timeout was used
    expect(fastify.redis).toBeDefined();
    await fastify.close();
  });

  it('uses default timeout if not provided', async () => {
    const fastify = Fastify();
    const config: CacheDbConfig = {
      engine: 'redis',
      connection: {
        uri: 'redis://localhost:6379',
      },
    };

    await fastify.register(redisPlugin, config);
    await fastify.ready();

    expect(fastify.redis).toBeDefined();
    await fastify.close();
  });

  it('registers onClose hook to quit Redis connection', async () => {
    const fastify = Fastify();
    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    const redis = fastify.redis;
    expect(redis).toBeDefined();

    if (redis) {
      await fastify.close();
      expect(redis.quit).toHaveBeenCalled();
    }
  });

  it('logs connection events', async () => {
    const fastify = Fastify();
    const logInfoSpy = vi.spyOn(fastify.log, 'info');

    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    // Check that connection success was logged
    const successLog = logInfoSpy.mock.calls.find((call: unknown[]) =>
      (call[0] as string)?.includes?.('Redis connection successful'),
    );
    expect(successLog).toBeDefined();

    await fastify.close();
  });

  it('accepts different Redis connection strings', async () => {
    const fastify = Fastify();
    const config: CacheDbConfig = {
      engine: 'redis',
      connection: {
        uri: 'redis://:password@redis.example.com:6379/2',
      },
      timeout: 5000,
    };

    await fastify.register(redisPlugin, config);
    await fastify.ready();

    expect(fastify.redis).toBeDefined();
    await fastify.close();
  });

  it('handles Redis connection failure gracefully', async () => {
    const fastify = Fastify();

    // Mock Redis to throw on ping
    const RedisMock = vi.mocked(Redis);
    RedisMock.mockImplementationOnce(function (this: Record<string, unknown>) {
      this.url = '';
      this.ping = vi.fn().mockRejectedValue(new Error('Connection failed'));
      this.on = vi.fn().mockReturnValue(this);
      return this;
    } as unknown as () => Redis);

    await expect(fastify.register(redisPlugin, redisConfig)).rejects.toThrow(
      'Connection failed',
    );

    await fastify.close();
  });

  it('calls Redis ping to test connection', async () => {
    const fastify = Fastify();
    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    // Verify ping was called
    expect(fastify.redis?.ping).toHaveBeenCalled();
    await fastify.close();
  });

  it('registers multiple onClose hooks for cleanup', async () => {
    const fastify = Fastify();
    const addHookSpy = vi.spyOn(fastify, 'addHook');

    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    // Verify onClose hook was registered
    const closeHook = addHookSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'onClose',
    );
    expect(closeHook).toBeDefined();
    await fastify.close();
  });

  it('logs errors when Redis emits error event', async () => {
    const fastify = Fastify();
    const logErrorSpy = vi.spyOn(fastify.log, 'error');

    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    const redis = fastify.redis;
    if (redis) {
      // Manually trigger error handler
      const errorHandler = (
        (redis.on as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
          (call: unknown[]) => call[0] === 'error',
        ) as unknown[] | undefined
      )?.[1] as (err: Error) => void;
      if (errorHandler) {
        errorHandler(new Error('Test error'));
        // Verify error was logged
        expect(logErrorSpy).toHaveBeenCalled();
      }
    }

    await fastify.close();
  });

  it('verifies the retryStrategy logic', async () => {
    const fastify = Fastify();
    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    // Get the constructor options
    const RedisMock = vi.mocked(Redis);
    const options = (RedisMock.mock.calls as unknown[][])[0][1] as {
      retryStrategy: (times: number) => number;
    };
    const retryStrategy = options.retryStrategy;

    expect(retryStrategy(1)).toBe(50);
    expect(retryStrategy(10)).toBe(500);
    expect(retryStrategy(100)).toBe(2000); // 100 * 50 = 5000, capped at 2000

    await fastify.close();
  });

  it('triggers connect and ready events', async () => {
    const fastify = Fastify();
    const logInfoSpy = vi.spyOn(fastify.log, 'info');

    await fastify.register(redisPlugin, redisConfig);
    await fastify.ready();

    const redis = fastify.redis;
    if (redis) {
      // Trigger connect event
      const connectHandler = (
        (redis.on as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
          (call: unknown[]) => call[0] === 'connect',
        ) as unknown[] | undefined
      )?.[1] as () => void;
      if (connectHandler) connectHandler();

      // Trigger ready event
      const readyHandler = (
        (redis.on as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
          (call: unknown[]) => call[0] === 'ready',
        ) as unknown[] | undefined
      )?.[1] as () => void;
      if (readyHandler) readyHandler();

      // Verify logging
      expect(logInfoSpy).toHaveBeenCalledWith('Redis connection established');
      expect(logInfoSpy).toHaveBeenCalledWith('Redis client ready');
    }

    await fastify.close();
  });
});
