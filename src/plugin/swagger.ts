import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    const {docs: docsConfig, auth} = fastify.appConfig;
    const swaggerConfig = docsConfig.openapi;
    const components: Record<string, unknown> = {};

    if (auth?.enableAuth && auth?.authEngine === 'up-auth') {
      components['securitySchemes'] = {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      };
    }

    if (auth?.enableAuth && auth.authEngine === 'api-key') {
      components['securitySchemes'] = {
        apiKeyAuth: {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
        },
      };
    }

    await fastify.register(swagger, {
      openapi: {
        info: swaggerConfig.info,
        components,
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: swaggerConfig.path,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  },
  {
    name: 'swagger-plugin',
  },
);
