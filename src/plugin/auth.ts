import fastifyJwt from '@fastify/jwt';
import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    const authConfig = fastify.appConfig?.auth;

    if (!authConfig || authConfig.authEngine === 'up-auth') {
      await fastify.register(fastifyJwt, {
        secret: 'your-super-secret-key',
      });

      fastify.decorateRequest(
        'authenticate',
        async function (this: FastifyRequest) {
          await (
            this as FastifyRequest & {jwtVerify: () => Promise<unknown>}
          ).jwtVerify();
        },
      );
    } else if (authConfig.authEngine === 'api-key') {
      const apiKey = authConfig.apiKey;

      fastify.decorateRequest(
        'authenticate',
        async function (this: FastifyRequest) {
          const key = this.headers['x-api-key'];
          if (!key || key !== apiKey) {
            throw new Error('Invalid or missing API key');
          }
        },
      );
    }
  },
  {
    name: 'auth-plugin',
  },
);
