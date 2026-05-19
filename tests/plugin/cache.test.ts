import Fastify, {FastifyInstance} from 'fastify';
import Redis from 'ioredis';
import {afterEach, beforeEach, describe, expect, it, Mock, vi} from 'vitest';

import cachePlugin from '@/plugin/cache';

import {AppConfig, CacheDbConfig} from '@/interfaces/config';

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(
    class {
      on = vi.fn();
      ping = vi.fn().mockResolvedValue('PONG');
      get = vi.fn();
      set = vi.fn();
      del = vi.fn();
      exists = vi.fn();
      flushdb = vi.fn();
      quit = vi.fn();
    } as unknown as () => unknown,
  );
  return {default: RedisMock};
});

describe('cache plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('NodeCache', () => {
    it('uses node-cache when no cache_db is provided', async () => {
      app = Fastify();
      app.appConfig = {} as unknown as AppConfig;
      await app.register(cachePlugin);
      await app.ready();

      expect(app.hasDecorator('cache')).toBe(true);
      expect(app.cache.raw.constructor.name).toBe('NodeCache');
    });

    it('performs node-cache operations', async () => {
      app = Fastify();
      app.appConfig = {} as unknown as AppConfig;
      await app.register(cachePlugin);
      await app.ready();

      expect(await app.cache.get('foo')).toBeNull();

      await app.cache.set('foo', 'bar');
      expect(await app.cache.get('foo')).toBe('bar');

      await app.cache.set('foo2', 'bar2', 100);
      expect(await app.cache.get('foo2')).toBe('bar2');

      expect(await app.cache.has('foo')).toBe(true);

      await app.cache.delete('foo');
      expect(await app.cache.has('foo')).toBe(false);

      await app.cache.set('key', 'val');
      await app.cache.clear();
      expect(await app.cache.get('key')).toBeNull();
    });
  });

  describe('Redis Cache', () => {
    beforeEach(() => {
      app = Fastify();
      const mockConfig: CacheDbConfig = {
        engine: 'redis',
        connection: {
          uri: 'redis://localhost:6379',
        },
      };
      app.appConfig = {cache_db: mockConfig} as unknown as AppConfig;

      // Need to setup vi.mocked so we can control the instance methods properly,
      // but since we mocked the constructor we can intercept via vi.mocked
      (Redis as unknown as Mock).mockClear();
    });

    it('uses redis when cache_db engine is redis', async () => {
      const mockPing = vi.fn().mockResolvedValue('PONG');
      (Redis as unknown as Mock).mockImplementation(
        class {
          on = vi.fn();
          ping = mockPing;
          quit = vi.fn();
        } as unknown as () => unknown,
      );

      await app.register(cachePlugin);
      await app.ready();

      expect(app.hasDecorator('cache')).toBe(true);
      expect(mockPing).toHaveBeenCalled();

      const MockRedisConstructor = vi.mocked(Redis);
      const mockCalls = MockRedisConstructor.mock.calls as unknown as Array<
        [string, {retryStrategy?: (times: number) => number}]
      >;
      const args = mockCalls[0];
      const retryStrategy = args[1]?.retryStrategy;

      expect(retryStrategy?.(10)).toBe(500);
      expect(retryStrategy?.(100)).toBe(2000);
    });

    it('throws error when redis connection fails', async () => {
      const mockPing = vi
        .fn()
        .mockRejectedValue(new Error('Connection Failed'));
      (Redis as unknown as Mock).mockImplementation(
        class {
          on = vi.fn();
          ping = mockPing;
          quit = vi.fn();
        } as unknown as () => unknown,
      );

      await expect(app.register(cachePlugin)).rejects.toThrow(
        'Connection Failed',
      );
    });

    it('performs redis operations', async () => {
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('"bar"')
        .mockResolvedValueOnce('invalid json');
      const mockSet = vi.fn().mockResolvedValue('OK');
      const mockExists = vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      const mockDel = vi.fn().mockResolvedValue(1);
      const mockFlushDb = vi.fn().mockResolvedValue('OK');

      (Redis as unknown as Mock).mockImplementation(
        class {
          on = (event: string, cb: (err?: Error) => void) => {
            if (event === 'error') cb(new Error('test error'));
            if (event === 'connect') cb();
            if (event === 'ready') cb();
          };
          ping = vi.fn().mockResolvedValue('PONG');
          get = mockGet;
          set = mockSet;
          del = mockDel;
          exists = mockExists;
          flushdb = mockFlushDb;
          quit = vi.fn();
        } as unknown as () => unknown,
      );

      await app.register(cachePlugin);
      await app.ready();

      // get missing
      expect(await app.cache.get('foo')).toBeNull();
      // get stringified
      expect(await app.cache.get('foo')).toBe('bar');
      // get fallback non-json
      expect(await app.cache.get('foo')).toBe('invalid json');

      // set object
      await app.cache.set('obj', {a: 1});
      expect(mockSet).toHaveBeenCalledWith('obj', '{"a":1}');

      // set string
      await app.cache.set('str', 'val');
      expect(mockSet).toHaveBeenCalledWith('str', 'val');

      // set with ttl
      await app.cache.set('ttl', 'val', 10);
      expect(mockSet).toHaveBeenCalledWith('ttl', 'val', 'EX', 10);

      // exists
      expect(await app.cache.has('exist')).toBe(true);
      expect(await app.cache.has('miss')).toBe(false);

      // del
      await app.cache.delete('key');
      expect(mockDel).toHaveBeenCalledWith('key');

      // clear
      await app.cache.clear();
      expect(mockFlushDb).toHaveBeenCalled();
    });
  });
});
