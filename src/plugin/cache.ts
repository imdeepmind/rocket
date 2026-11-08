import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import NodeCache from 'node-cache';

import {ResolvedAppConfig} from '@/interfaces/config';

export const NODE_CACHE_OTP_WARNING =
  'No cache configured; OTPs are stored in node-cache (in-memory). OTPs are not shared across processes and will be lost on restart.';

export function isRedisCacheConfigured(config: ResolvedAppConfig): boolean {
  return config.infrastructure.cache.engine === 'redis';
}

export interface ICache {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  ping(): Promise<void>;
  raw: Redis | NodeCache;
}

export default fp(
  async (fastify: FastifyInstance) => {
    let cacheWrapper: ICache;
    const cacheConfig = fastify.appConfig.infrastructure.cache;

    if (cacheConfig.engine === 'redis') {
      // Use Redis
      const redis = new Redis(cacheConfig.connection.url, {
        connectTimeout: cacheConfig.timeout,
        retryStrategy: times => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });

      redis.on('error', err => {
        fastify.log.error(`Redis connection error: ${err.message}`);
      });

      redis.on('connect', () => {
        fastify.log.info('Redis connection established');
      });

      redis.on('ready', () => {
        fastify.log.info('Redis client ready');
      });

      try {
        await redis.ping();
        fastify.log.info(
          `Redis connection successful to ${cacheConfig.connection.url}`,
        );
      } catch (err) {
        fastify.log.error(`Failed to connect to Redis: ${err}`);
        throw err;
      }

      cacheWrapper = {
        async get<T>(key: string) {
          const val = await redis.get(key);
          if (!val) return null;
          try {
            return JSON.parse(val) as T;
          } catch {
            return val as unknown as T;
          }
        },
        async set<T>(key: string, value: T, ttlSeconds?: number) {
          const strVal =
            typeof value === 'string' ? value : JSON.stringify(value);
          if (ttlSeconds) {
            await redis.set(key, strVal, 'EX', ttlSeconds);
          } else {
            await redis.set(key, strVal);
          }
        },
        async delete(key: string) {
          await redis.del(key);
        },
        async has(key: string) {
          const exists = await redis.exists(key);
          return exists > 0;
        },
        async clear() {
          await redis.flushdb();
        },
        async ping() {
          await redis.ping();
        },
        raw: redis,
      };

      fastify.addHook('onClose', async () => {
        fastify.log.info('Closing Redis connection...');
        await redis.quit();
        fastify.log.info('Redis connection closed.');
      });
    } else {
      // Use node-cache
      fastify.log.info('Using node-cache for caching');
      const nodeCache = new NodeCache();

      cacheWrapper = {
        async get<T>(key: string) {
          const val = nodeCache.get<T>(key);
          return val === undefined ? null : val;
        },
        async set<T>(key: string, value: T, ttlSeconds?: number) {
          if (ttlSeconds) {
            nodeCache.set(key, value, ttlSeconds);
          } else {
            nodeCache.set(key, value);
          }
        },
        async delete(key: string) {
          nodeCache.del(key);
        },
        async has(key: string) {
          return nodeCache.has(key);
        },
        async clear() {
          nodeCache.flushAll();
        },
        async ping() {
          const probeKey = '__healthcheck_probe__';
          nodeCache.set(probeKey, 1, 1);
          nodeCache.del(probeKey);
        },
        raw: nodeCache,
      };

      fastify.addHook('onClose', async () => {
        fastify.log.info('Closing node-cache...');
        nodeCache.close();
      });
    }

    fastify.decorate('cache', cacheWrapper);
  },
  {
    name: 'cache-plugin',
  },
);
