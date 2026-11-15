import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import fastifyJwt from '@fastify/jwt';
import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    const {authentication} = fastify.appConfig;

    // Required by the SSO flow: the correlation payload travels in a
    // `__Host-` cookie, never in the URL.
    await fastify.register(cookie);

    if (!authentication.enabled) {
      // Auth is disabled: no JWT is registered and `authenticate` always
      // rejects. The plugin itself is always registered so the decorated
      // request method exists regardless of configuration.
      fastify.decorateRequest('authenticate', async () => {
        throw new Error('Authentication is not enabled');
      });
      return;
    }

    const apiKey = authentication.providers.find(
      provider => provider.type === 'api-key',
    );

    if (apiKey?.type === 'api-key') {
      const {key} = apiKey.config;

      fastify.decorateRequest(
        'authenticate',
        async function (this: FastifyRequest) {
          const provided = this.headers['x-api-key'];

          if (!provided || provided !== key) {
            throw new Error('Invalid or missing API key');
          }
        },
      );
      return;
    }

    const {jwtSecret} = authentication;

    if (jwtSecret) {
      await fastify.register(fastifyJwt, {secret: jwtSecret});
    }

    fastify.decorateRequest(
      'authenticate',
      async function (this: FastifyRequest) {
        /* c8 ignore start - jwtVerify is always present when jwtSecret is set */
        if (typeof this.jwtVerify !== 'function') {
          throw new Error('Authentication is not enabled');
        }
        /* c8 ignore stop */

        await this.jwtVerify();
      },
    );

    // The SAML ACS is an `application/x-www-form-urlencoded` POST from the
    // identity provider.
    const hasSaml = authentication.providers.some(
      provider => provider.type === 'sso' && provider.protocol === 'saml',
    );

    if (hasSaml) {
      await fastify.register(formbody);
    }
  },
  {
    name: 'auth-plugin',
  },
);
