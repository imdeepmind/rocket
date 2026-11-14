import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createMemcacheCache} from '@/lib/cache/memcache';

import {CacheLogger} from '@/interfaces/cache';

const {clientMock, createMock} = vi.hoisted(() => {
  const clientMock = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    flush: vi.fn(),
    quit: vi.fn(),
  };

  return {
    clientMock,
    createMock: vi.fn(() => clientMock),
  };
});

vi.mock('memjs', () => ({
  Client: {
    create: createMock,
  },
}));

const config = {
  engine: 'memcached' as const,
  connection: {url: 'localhost:11211'},
  timeout: 5000,
};

function createLogger(): CacheLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

function getClientOptions(): {
  timeout: number;
  conntimeout: number;
  logger: {log: (...args: unknown[]) => void};
} {
  return (
    createMock.mock.calls[0] as unknown as [
      string,
      {
        timeout: number;
        conntimeout: number;
        logger: {log: (...args: unknown[]) => void};
      },
    ]
  )[1];
}

describe('createMemcacheCache', () => {
  let logger: CacheLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLogger();

    clientMock.get.mockResolvedValue({value: null, flags: null});
    clientMock.set.mockResolvedValue(true);
    clientMock.delete.mockResolvedValue(true);
    clientMock.flush.mockResolvedValue({});
    clientMock.quit.mockReturnValue(undefined);
  });

  it('creates the client with millisecond timeouts converted to seconds', () => {
    createMemcacheCache(config, {logger});

    expect(createMock).toHaveBeenCalledWith('localhost:11211', {
      timeout: 5,
      conntimeout: 5,
      logger: {log: expect.any(Function)},
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Memcached client created for localhost:11211',
    );
  });

  it('strips the optional memcached scheme', () => {
    createMemcacheCache(
      {
        ...config,
        connection: {url: 'memcached://cache.internal:11211'},
      },
      {logger},
    );

    expect(createMock).toHaveBeenCalledWith(
      'cache.internal:11211',
      expect.any(Object),
    );
  });

  it('forwards memjs logs to the logger', () => {
    createMemcacheCache(config, {logger});

    getClientOptions().logger.log('server', 'failed');

    expect(logger.error).toHaveBeenCalledWith('Memcached: server failed');
  });

  it('ignores memjs logs when no logger is provided', () => {
    createMemcacheCache(config);

    expect(() =>
      getClientOptions().logger.log('server', 'failed'),
    ).not.toThrow();
  });

  it('reads and decodes buffered values', async () => {
    const cache = createMemcacheCache(config, {logger});
    clientMock.get
      .mockResolvedValueOnce({value: null, flags: null})
      .mockResolvedValueOnce({value: Buffer.from('{"a":1}'), flags: null})
      .mockResolvedValueOnce({value: Buffer.from('plain text'), flags: null});

    expect(await cache.get('missing')).toBeNull();
    expect(await cache.get<{a: number}>('object')).toEqual({a: 1});
    expect(await cache.get('plain')).toBe('plain text');
  });

  it('writes JSON values with and without TTL', async () => {
    const cache = createMemcacheCache(config, {logger});

    await cache.set('object', {a: 1});
    await cache.set('string', 'value');
    await cache.set('ttl', 'value', 30);

    expect(clientMock.set).toHaveBeenNthCalledWith(1, 'object', '{"a":1}');
    expect(clientMock.set).toHaveBeenNthCalledWith(2, 'string', '"value"');
    expect(clientMock.set).toHaveBeenNthCalledWith(3, 'ttl', '"value"', {
      expires: 30,
    });
  });

  it('supports delete, has, clear and ping', async () => {
    const cache = createMemcacheCache(config, {logger});
    clientMock.get
      .mockResolvedValueOnce({value: Buffer.from('"value"'), flags: null})
      .mockResolvedValueOnce({value: null, flags: null});

    await cache.delete('key');
    expect(clientMock.delete).toHaveBeenCalledWith('key');

    expect(await cache.has('present')).toBe(true);
    expect(await cache.has('missing')).toBe(false);

    await cache.clear();
    expect(clientMock.flush).toHaveBeenCalledTimes(1);

    await expect(cache.ping()).resolves.toBeUndefined();
    expect(clientMock.get).toHaveBeenCalledWith('__healthcheck_probe__');
  });

  it('propagates client errors', async () => {
    const cache = createMemcacheCache(config, {logger});
    clientMock.get.mockRejectedValueOnce(new Error('Memcached is down'));

    await expect(cache.get('key')).rejects.toThrow('Memcached is down');
  });

  it('quits the client on close and logs it', async () => {
    const cache = createMemcacheCache(config, {logger});

    await cache.close();

    expect(clientMock.quit).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Closing Memcached connection...');
    expect(logger.info).toHaveBeenCalledWith('Memcached connection closed.');
  });

  it('closes without a logger', async () => {
    const cache = createMemcacheCache(config);

    await expect(cache.close()).resolves.toBeUndefined();
    expect(clientMock.quit).toHaveBeenCalledTimes(1);
  });
});
