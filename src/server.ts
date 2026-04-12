import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify, {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import migrateDatabase from '@/migrator';
import dbPlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerModelRoutes} from '@/routes';

import {Mode} from '@/schema';
import {AppConfig, SwaggerConfig} from '@/schema/config';

import {validateConfig} from '@/validators/config';
import {RouteInfo, showWelcomeScreen} from '@/utils/welcome';

async function registerSwagger(
  swaggerConfig: SwaggerConfig,
  app: FastifyInstance,
) {
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

export async function startServer(
  config: AppConfig,
  port: number,
  mode: Mode,
): Promise<FastifyInstance> {
  // validate the schema
  config = validateConfig(config);

  const routes: RouteInfo[] = [];

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

  // Track each registered route
  app.addHook('onRoute', routeOptions => {
    routes.push({
      method: Array.isArray(routeOptions.method)
        ? routeOptions.method.join('/')
        : routeOptions.method,
      url: routeOptions.url,
    });
  });

  // config-driven DB
  await app.register(dbPlugin, {
    engine: config.database.engine,
    connection: config.database.connection,
  });
  await app.register(responsePlugin);

  // migrate the db based on config
  await migrateDatabase(config);

  // register swagger
  await registerSwagger(config.swagger, app);

  // register config-driven model routes
  if (config.models && config.models.length > 0) {
    registerModelRoutes(app, config.models);
  }

  // Global error handler
  app.setErrorHandler(
    (
      err: FastifyError & {code?: string},
      req: FastifyRequest,
      reply: FastifyReply,
    ) => {
      req.log.error(err);

      // Default from Fastify or fallback
      let statusCode: number = err.statusCode || 500;

      // If this looks like a Postgres DatabaseError, classify 4xx vs 5xx
      if (err.code) {
        const code = err.code;
        // Data & integrity errors (invalid data, constraint violations) → 4xx
        // Common classes:
        // - 22xxx: data exceptions (e.g. invalid_text_representation, numeric_value_out_of_range)
        // - 23xxx: integrity constraint violations (e.g. unique_violation, foreign_key_violation)
        if (code.startsWith('22') || code.startsWith('23')) {
          statusCode = 400;
        }
        // Connection exceptions (08xxx) → 5xx (service unavailable)
        else if (code.startsWith('08')) {
          statusCode = 503;
        } else {
          statusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
        }
      }

      const payload = app.buildResponse(statusCode, err.message, null, {
        error: err.name,
        code: err.code,
        ...(err.validation ? {validation: err.validation} : {}),
      });

      reply.status(statusCode).send(payload);
    },
  );

  try {
    showWelcomeScreen(config, port, routes);
    await app.listen({port, host: '0.0.0.0'});

    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
