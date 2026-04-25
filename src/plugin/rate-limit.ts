import rateLimit, {FastifyRateLimitOptions} from '@fastify/rate-limit';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

import {RateLimitConfig} from '@/schema/config';

import {parseDuration} from '@/utils/duration';

export interface RateLimitPluginOptions {
  rateLimit: RateLimitConfig;
  redis?: Redis;
}

export default fp(
  async (fastify: FastifyInstance, opts: RateLimitPluginOptions) => {
    const {rateLimit: config, redis} = opts;

    // If rate limiting is disabled, skip registration
    if (!config.enabled) {
      fastify.log.info('Rate limiting is disabled');
      return;
    }

    try {
      // Parse the time window from duration string to milliseconds
      const windowMs = parseDuration(config.timeWindow);

      // Prepare rate limit options
      const rateLimitOpts: FastifyRateLimitOptions = {
        max: config.max,
        timeWindow: windowMs,
        cache: config.useRedis && redis ? 1000 : 10000,
        redis: config.useRedis && redis ? redis : undefined,
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
