import rateLimit, {FastifyRateLimitOptions} from '@fastify/rate-limit';
import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import {parseDuration} from '@/utils/duration';

function normalizeDocsPath(path: string): string | null {
  const normalized = path.replace(/\/+$/, '');

  // A docs mount at the root would exempt every request from rate limiting.
  return normalized === '' ? null : normalized;
}

function isDocsRequest(url: string, docsPath: string | null): boolean {
  if (docsPath === null) {
    return false;
  }

  const pathname = url.split('?')[0];

  return pathname === docsPath || pathname.startsWith(`${docsPath}/`);
}

export default fp(
  async (fastify: FastifyInstance) => {
    const config = fastify.appConfig.application.rateLimit;
    const docs = fastify.appConfig.docs.openapi;

    const windowMs = parseDuration(config.timeWindow);
    const docsPath = docs.enabled ? normalizeDocsPath(docs.path) : null;

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
            if (!val || val.expiresAt <= now) {
              val = {current: 1, expiresAt: now + windowMs};
            } else {
              val.current += 1;
            }
            const ttlSeconds = Math.max(
              1,
              Math.ceil((val.expiresAt - now) / 1000),
            );
            fastify.cache
              .set(key, val, ttlSeconds)
              .then(() => {
                cb(null, {
                  current: val.current,
                  ttl: Math.max(0, val.expiresAt - now),
                });
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
      // Swagger UI loads its HTML, OpenAPI spec, and static assets in parallel.
      // Those requests must not consume the caller's quota, otherwise the UI
      // fails to render (and consumes the limit meant for the API).
      allowList: (request: FastifyRequest) =>
        isDocsRequest(request.url, docsPath),
    };

    await fastify.register(rateLimit, rateLimitOpts);
  },
  {
    name: 'rate-limit-plugin',
  },
);
