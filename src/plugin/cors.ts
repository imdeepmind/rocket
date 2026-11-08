import fastifyCors, {FastifyCorsOptions} from '@fastify/cors';
import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import picomatch from 'picomatch';

export default fp(async (fastify: FastifyInstance) => {
  const corsConfig = fastify.appConfig.application.cors;

  if (!corsConfig || !corsConfig.enabled) {
    return;
  }

  const {
    origins,
    methods,
    allowedHeaders,
    exposedHeaders,
    credentials,
    maxAge,
    routes,
  } = corsConfig;

  const isWildcard = origins.includes('*') && !credentials;
  const isRouteScoped = Array.isArray(routes) && routes.length > 0;
  const routeMatcher = isRouteScoped ? picomatch(routes) : null;

  await fastify.register(fastifyCors, {
    delegator: (req: FastifyRequest, callback) => {
      // 1. Route scoping check
      if (routeMatcher) {
        const urlPath = req.url.split('?')[0].split('#')[0];
        if (!routeMatcher(urlPath)) {
          callback(null, {origin: false});
          return;
        }
      }

      // 2. Origin validation
      const reqOrigin = req.headers.origin;
      let allowedOrigin: boolean | string = false;

      if (reqOrigin && reqOrigin !== 'null') {
        if (isWildcard) {
          allowedOrigin = '*';
        } else if (origins.includes(reqOrigin)) {
          allowedOrigin = reqOrigin;
        }
      }

      const options: FastifyCorsOptions = {
        origin: allowedOrigin,
        methods,
        allowedHeaders: allowedHeaders.length > 0 ? allowedHeaders : undefined,
        exposedHeaders: exposedHeaders.length > 0 ? exposedHeaders : undefined,
        credentials,
        maxAge,
      };

      callback(null, options);
    },
  });
});
