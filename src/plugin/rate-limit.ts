import rateLimit, {FastifyRateLimitOptions} from '@fastify/rate-limit';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {RateLimitConfig} from '@/interfaces/config';

import {parseDuration} from '@/utils/duration';

export interface RateLimitPluginOptions {
  rateLimit: RateLimitConfig;
}

export default fp(
  async (fastify: FastifyInstance, opts: RateLimitPluginOptions) => {
    const {rateLimit: config} = opts;

    // If rate limiting is disabled, skip registration
    if (!config.enabled) {
      fastify.log.info('Rate limiting is disabled');
      return;
    }

    try {
      // Parse the time window from duration string to milliseconds
      const windowMs = parseDuration(config.timeWindow);

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
        max: config.max,
        timeWindow: windowMs,
        store: CustomCacheStore,
      };

      // Register the rate-limit plugin
      await fastify.register(rateLimit, rateLimitOpts);

      fastify.log.info(
        `Rate limiting configured: ${config.max} requests per ${config.timeWindow}`,
      );
    } catch (err) {
      fastify.log.error(`Failed to setup rate limiting: ${err}`);
      throw err;
    }
  },
  {
    name: 'rate-limit-plugin',
  },
);
