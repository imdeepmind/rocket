import fastifyJwt from '@fastify/jwt';
import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import {UpAuthProviderConfig} from '@/interfaces/config';

export default fp(
  async (fastify: FastifyInstance) => {
    const authentication = fastify.appConfig?.authentication;

    if (
      authentication?.enabled &&
      authentication.provider?.type === 'up-auth'
    ) {
      const upConfig = authentication.provider.config as UpAuthProviderConfig;
      await fastify.register(fastifyJwt, {
        secret: upConfig.jwtSecret || 'this-will-never-be-used',
      });

      fastify.decorateRequest(
        'authenticate',
        async function (this: FastifyRequest) {
          await (
            this as FastifyRequest & {jwtVerify: () => Promise<unknown>}
          ).jwtVerify();
        },
      );
    } else if (
      authentication?.enabled &&
      authentication.provider?.type === 'api-key'
    ) {
      const apiKey = (authentication.provider.config as {key: string}).key;

      fastify.decorateRequest(
        'authenticate',
        async function (this: FastifyRequest) {
          const key = this.headers['x-api-key'];
          if (!key || key !== apiKey) {
            throw new Error('Invalid or missing API key');
          }
        },
      );
    } else {
      // Auth is disabled: no JWT is registered and `authenticate` always
      // rejects. The plugin itself is always registered so the decorated
      // request method exists regardless of configuration.
      fastify.decorateRequest('authenticate', async () => {
        throw new Error('Authentication is not enabled');
      });
    }
  },
  {
    name: 'auth-plugin',
  },
);
