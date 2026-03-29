import chalk from 'chalk';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { AppConfig, Mode } from './types';
import dbPlugin from './plugin/database';
import { createTables } from './database/table-creator';
import { createIndexes } from './database/index-creator';
import { createForeignKeys } from './database/fk-creator';

async function registerSwagger(swaggerConfig: AppConfig['swagger'], app: FastifyInstance) {
  if (swaggerConfig.enabled) {
    // Swagger (OpenAPI spec)
    await app.register(swagger, {
      openapi: {
        info: swaggerConfig.info,
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
      try {
        const users = await app.db.query('SELECT * FROM "users";');
        return { message: `Found ${users.length} users in the dynamic table.` };
      } catch (e: unknown) {
        return { message: `Error querying users: ${(e as Error).message}` };
      }
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

  // config-driven DB
  await app.register(dbPlugin, {
    engine: config.database.engine,
    connection: config.database.connection,
  });

  // Auto-generate tables, indexes, and foreign keys if models are provided
  if (config.models && config.models.length > 0) {
    await createTables(app.db, config.models, config.database.engine, app.log);
    await createIndexes(app.db, config.models, config.database.engine, app.log);
    await createForeignKeys(app.db, config.models, config.database.engine, app.log);
  }

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
    await app.listen({ port, host: '0.0.0.0' });
    console.log(chalk.blue(`Server running at http://0.0.0.0:${port}`));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
