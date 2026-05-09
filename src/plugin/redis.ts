import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

import {CacheDbConfig} from '@/interfaces/config';

export default fp(
  async (fastify: FastifyInstance, opts: CacheDbConfig) => {
    try {
      const redis = new Redis(opts.connection.uri, {
        connectTimeout: opts.timeout ?? 5000,
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      // Listen for connection errors
      redis.on('error', err => {
        fastify.log.error(`Redis connection error: ${err.message}`);
      });

      redis.on('connect', () => {
        fastify.log.info('Redis connection established');
      });

      redis.on('ready', () => {
        fastify.log.info('Redis client ready');
      });

      // Test connection
      await redis.ping();
      fastify.log.info(`Redis connection successful to ${opts.connection.uri}`);

      // attach to fastify
      fastify.decorate('redis', redis);

      // cleanup on shutdown
      fastify.addHook('onClose', async () => {
        fastify.log.info('Closing Redis connection...');
        await redis.quit();
        fastify.log.info('Redis connection closed.');
      });
    } catch (err) {
      fastify.log.error(`Failed to connect to Redis: ${err}`);
      throw err;
    }
  },
  {
    name: 'redis-plugin',
  },
);
