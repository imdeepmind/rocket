import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createRedisCache} from '@/lib/cache/redis';

import {CacheLogger} from '@/interfaces/cache';

const {redisMock, redisConstructorCalls, RedisMock} = vi.hoisted(() => {
  const redisMock = {
    on: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    flushdb: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
  };
  const redisConstructorCalls: unknown[][] = [];

  class RedisMock {
    on = redisMock.on;
    get = redisMock.get;
    set = redisMock.set;
    del = redisMock.del;
    exists = redisMock.exists;
    flushdb = redisMock.flushdb;
    ping = redisMock.ping;
    quit = redisMock.quit;

    constructor(...args: unknown[]) {
      redisConstructorCalls.push(args);
    }
  }

  return {redisMock, redisConstructorCalls, RedisMock};
});

vi.mock('ioredis', () => ({
  default: RedisMock,
}));

const config = {
  engine: 'redis' as const,
  connection: {url: 'redis://localhost:6379'},
  timeout: 5000,
};

function createLogger(): CacheLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

function getListener(event: string): (err?: Error) => void {
  const call = redisMock.on.mock.calls.find(([name]) => name === event);
  return call?.[1] as (err?: Error) => void;
}

describe('createRedisCache', () => {
  let logger: CacheLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLogger();
    redisConstructorCalls.length = 0;

    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    redisMock.del.mockResolvedValue(1);
    redisMock.exists.mockResolvedValue(0);
    redisMock.flushdb.mockResolvedValue('OK');
    redisMock.ping.mockResolvedValue('PONG');
    redisMock.quit.mockResolvedValue('OK');
  });

  it('creates the client with connection and retry options', () => {
    createRedisCache(config, {logger});

    expect(redisConstructorCalls).toHaveLength(1);
    expect(redisConstructorCalls[0][0]).toBe('redis://localhost:6379');
    expect(redisConstructorCalls[0][1]).toMatchObject({
      connectTimeout: 5000,
      retryStrategy: expect.any(Function),
      maxRetriesPerRequest: 3,
    });

    const options = redisConstructorCalls[0][1] as {
      retryStrategy: (times: number) => number;
    };

    expect(options.retryStrategy(10)).toBe(500);
    expect(options.retryStrategy(100)).toBe(2000);
  });

  it('logs connection lifecycle events', () => {
    createRedisCache(config, {logger});

    getListener('error')(new Error('connection lost'));
    getListener('connect')();
    getListener('ready')();

    expect(logger.error).toHaveBeenCalledWith(
      'Redis connection error: connection lost',
    );
    expect(logger.info).toHaveBeenCalledWith('Redis connection established');
    expect(logger.info).toHaveBeenCalledWith('Redis client ready');
  });

  it('ignores lifecycle events when no logger is provided', () => {
    createRedisCache(config);

    expect(() => getListener('error')(new Error('boom'))).not.toThrow();
    expect(() => getListener('connect')()).not.toThrow();
    expect(() => getListener('ready')()).not.toThrow();
  });

  it('reads, parses and falls back for non-JSON values', async () => {
    const cache = createRedisCache(config, {logger});
    redisMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('{"a":1}')
      .mockResolvedValueOnce('plain text');

    expect(await cache.get('missing')).toBeNull();
    expect(await cache.get<{a: number}>('object')).toEqual({a: 1});
    expect(await cache.get('plain')).toBe('plain text');
  });

  it('writes JSON values with and without TTL', async () => {
    const cache = createRedisCache(config, {logger});

    await cache.set('object', {a: 1});
    await cache.set('string', 'value');
    await cache.set('ttl', 'value', 30);

    expect(redisMock.set).toHaveBeenNthCalledWith(1, 'object', '{"a":1}');
    expect(redisMock.set).toHaveBeenNthCalledWith(2, 'string', '"value"');
    expect(redisMock.set).toHaveBeenNthCalledWith(
      3,
      'ttl',
      '"value"',
      'EX',
      30,
    );
  });

  it('supports delete, has, clear and ping', async () => {
    const cache = createRedisCache(config, {logger});
    redisMock.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await cache.delete('key');
    expect(redisMock.del).toHaveBeenCalledWith('key');

    expect(await cache.has('present')).toBe(true);
    expect(await cache.has('missing')).toBe(false);

    await cache.clear();
    expect(redisMock.flushdb).toHaveBeenCalledTimes(1);

    await expect(cache.ping()).resolves.toBeUndefined();
    expect(redisMock.ping).toHaveBeenCalledTimes(1);
  });

  it('quits the client on close and logs it', async () => {
    const cache = createRedisCache(config, {logger});

    await cache.close();

    expect(redisMock.quit).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Closing Redis connection...');
    expect(logger.info).toHaveBeenCalledWith('Redis connection closed.');
  });

  it('closes without a logger', async () => {
    const cache = createRedisCache(config);

    await expect(cache.close()).resolves.toBeUndefined();
    expect(redisMock.quit).toHaveBeenCalledTimes(1);
  });
});
