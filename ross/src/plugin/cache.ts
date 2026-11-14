import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {createCache} from '@/lib/cache';

export default fp(
  async (fastify: FastifyInstance) => {
    const cache = createCache(fastify.appConfig.infrastructure.cache, {
      logger: fastify.log,
    });

    try {
      await cache.ping();
    } catch (err) {
      try {
        await cache.close();
      } catch {
        // Ignore cleanup failures and surface the original connection error.
      }
      throw err;
    }

    fastify.decorate('cache', cache);

    fastify.addHook('onClose', async () => {
      await cache.close();
    });
  },
  {
    name: 'cache-plugin',
  },
);
