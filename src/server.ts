import chalk from 'chalk';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { AppConfig, Mode } from './types';

async function registerSwagger(swaggerConfig: AppConfig['swagger'], app: FastifyInstance) {
  if (swaggerConfig.enabled) {
    // Swagger (OpenAPI spec)
    await app.register(swagger, {
      openapi: {
        info: {
          title: swaggerConfig.info.title,
          description: swaggerConfig.info.description,
          version: swaggerConfig.info.version,
        },
      },
    });

    // Swagger UI
    await app.register(swaggerUI, {
      routePrefix: swaggerConfig.basePath, // UI available at /docs
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }
}

async function registerRoutes(app: FastifyInstance) {
  // Example route with schema
  app.get(
    '/hello',
    {
      schema: {
        description: 'Hello route',
        tags: ['Default'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      return { message: 'Hello World' };
    }
  );
}

export async function startServer(config: AppConfig, port: number, mode: Mode) {
  const app: FastifyInstance = Fastify({
    logger:
      mode === 'dev'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : true,
  });

  // register swagger
  await registerSwagger(config.swagger, app);

  // register routes
  await registerRoutes(app);

  // Global error handler
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    req.log.error(err);
    reply.status(500).send({ error: err.message });
  });

  try {
    await app.listen({ port });
    console.log(chalk.blue(`Server running at http://localhost:${port}`));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
