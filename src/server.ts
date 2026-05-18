import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify, {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import migrateDatabase from '@/migrator';
import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import dbPlugin from '@/plugin/database';
import rateLimitPlugin from '@/plugin/rate-limit';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import webhookPlugin from '@/plugin/webhook';

import {registerRoutes} from '@/routes';
import {registerChangePasswordRoute} from '@/routes/auth/change-password';
import {registerLoginRoute} from '@/routes/auth/login';
import {registerRegistrationRoute} from '@/routes/auth/registration';

import {Mode} from '@/interfaces';
import {AppConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import {RouteInfo} from '@/utils/welcome';

export interface StartServerResult {
  app: FastifyInstance;
  routes: RouteInfo[];
}

async function registerSwagger(app: FastifyInstance, config: AppConfig) {
  const {swagger: swaggerConfig, auth} = config;
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
        name: 'api_key',
        in: 'header',
      },
    };
  }

  if (swaggerConfig.enabled) {
    // Swagger (OpenAPI spec)
    await app.register(swagger, {
      openapi: {
        info: swaggerConfig.info,
        components,
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
  verbose: boolean = false,
  migrate: boolean = false,
): Promise<StartServerResult> {
  // validate the schema
  config = validateConfig(config);

  const routes: RouteInfo[] = [];

  const app: FastifyInstance = Fastify({
    logger: {
      level: verbose ? 'debug' : config.application.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  app.appConfig = config;

  // Track each registered route
  app.addHook('onRoute', routeOptions => {
    routes.push({
      method: Array.isArray(routeOptions.method)
        ? routeOptions.method.join('/')
        : routeOptions.method,
      url: routeOptions.url,
      apiIdentifier: (routeOptions.config as {apiIdentifier?: string})
        ?.apiIdentifier,
    });
  });

  // config-driven DB
  await app.register(dbPlugin, config.database);

  // config-driven cache (Redis or NodeCache)
  await app.register(cachePlugin);

  // config-driven communicate
  if (config.communicate) {
    await app.register(communicatePlugin);
  }

  // config-driven rate limit
  if (config.application.rateLimit) {
    await app.register(rateLimitPlugin, {
      rateLimit: config.application.rateLimit,
    });
  }

  await app.register(responsePlugin);
  await app.register(sspPlugin);
  await app.register(webhookPlugin);
  if (config.auth) {
    await app.register(authPlugin);
  }

  // migrate the db based on config
  if (migrate) {
    await migrateDatabase(config);
  }

  // register swagger
  await registerSwagger(app, config);

  // register config-driven routes (models, aggregations, custom queries)
  registerRoutes(app, config);

  // register auth routes (only when up-auth is configured)
  if (config.auth) {
    registerRegistrationRoute(app, config);
    registerLoginRoute(app, config);
    registerChangePasswordRoute(app, config);
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

  return {app, routes};
}
