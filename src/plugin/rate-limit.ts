import rateLimit, {FastifyRateLimitOptions} from '@fastify/rate-limit';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {parseDuration} from '@/utils/duration';

export default fp(
  async (fastify: FastifyInstance) => {
    const config = fastify.appConfig.application.rateLimit;

    const windowMs = parseDuration(config!.timeWindow);

    class CustomCacheStore {
      constructor(private options: unknown) {}

      incr(
        key: string,
        cb: (
          err: Error | null,
          result?: {current: number; ttl: number},
        ) => void,
      ) {
        fastify.cache
          .get<{current: number; expiresAt: number}>(key)
          .then(val => {
            const now = Date.now();
            if (!val || val.expiresAt < now) {
              val = {current: 1, expiresAt: now + windowMs};
            } else {
              val.current += 1;
            }
            fastify.cache
              .set(key, val, Math.ceil((val.expiresAt - now) / 1000))
              .then(() => {
                cb(null, {current: val.current, ttl: val.expiresAt - now});
              })
              .catch(err => cb(err));
          })
          .catch(err => cb(err));
      }

      child() {
        return this;
      }
    }

    const rateLimitOpts: FastifyRateLimitOptions = {
      max: config!.max,
      timeWindow: windowMs,
      store: CustomCacheStore,
    };

    await fastify.register(rateLimit, rateLimitOpts);
  },
  {
    name: 'rate-limit-plugin',
  },
);
