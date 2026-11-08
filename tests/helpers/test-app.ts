import Fastify, {FastifyInstance} from 'fastify';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import webhookPlugin from '@/plugin/webhook';

import {resolveConfig} from '@/lib/config/resolve';
import {
  registerErrorHandler,
  registerNotFoundHandler,
} from '@/lib/server/error-handler';

import {registerRoutes} from '@/routes';

import {
  ApisConfig,
  AuthenticationConfig,
  CustomEndpointConfig,
  DatabaseConfig,
  ModelConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

export const mockModels: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true, autoIncrement: true},
      name: {type: 'string'},
      email: {type: 'string'},
    },
  },
};

export const pgConfig: DatabaseConfig = {
  engine: 'postgres',
  connection: {url: 'postgresql://postgres:postgres@localhost:5432/postgres'},
};

export const sqliteConfig: DatabaseConfig = {
  engine: 'sqlite',
  connection: {url: ':memory:'},
};

export async function createTestApp(
  dbConfig: DatabaseConfig,
  models: Record<string, ModelConfig> = {},
  apis?: ApisConfig,
  customEndpoints?: Record<string, CustomEndpointConfig>,
  authentication?: AuthenticationConfig,
  apiVariants?: Record<string, {variants: string[]}>,
): Promise<FastifyInstance> {
  const inputConfig = {
    application: {name: 'Test App', logLevel: 'error' as const},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', description: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {database: dbConfig},
    data: {models},
    apis,
    customEndpoints,
    authentication,
    apiVariants,
  };

  // Route tests exercise the resolved (dense) configuration in dev mode,
  // mirroring what `startServer` does in production.
  const appConfig: ResolvedAppConfig = resolveConfig(inputConfig, {
    mode: 'dev',
  });

  const fastify = Fastify();
  fastify.appConfig = appConfig;

  registerErrorHandler(fastify);
  registerNotFoundHandler(fastify);

  await fastify.register(databasePlugin);
  await fastify.register(cachePlugin);
  await fastify.register(responsePlugin);
  await fastify.register(sspPlugin);
  await fastify.register(webhookPlugin);
  await fastify.register(authPlugin);

  if (Object.keys(models).length > 0 || apis || customEndpoints) {
    // Mirror the production lifecycle in startServer: SSP injection runs in
    // preHandler so auth has populated request.user and AJV has validated.
    fastify.addHook('preHandler', async request => {
      fastify.enforceSSP(request);
    });
    registerRoutes(fastify, appConfig);
  }
  await fastify.ready();
  return fastify;
}
