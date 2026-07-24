import Fastify, {FastifyInstance} from 'fastify';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import webhookPlugin from '@/plugin/webhook';

import {registerRoutes} from '@/routes';

import {
  ApisConfig,
  AppConfig,
  AuthenticationConfig,
  CustomAPIConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

export const mockModels: Record<string, ModelConfig> = {
  users: {
    table: 'users',
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
  customAPIs?: CustomAPIConfig,
  authentication?: AuthenticationConfig,
): Promise<FastifyInstance> {
  const appConfig: AppConfig = {
    application: {name: 'Test App', logLevel: 'error'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', description: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {primaryDatabase: dbConfig},
    data: {models},
    apis,
    customAPIs,
    authentication,
  };

  const fastify = Fastify();
  fastify.appConfig = appConfig;

  await fastify.register(databasePlugin);
  await fastify.register(cachePlugin);
  await fastify.register(responsePlugin);
  await fastify.register(sspPlugin);
  await fastify.register(webhookPlugin);
  await fastify.register(authPlugin);

  if (Object.keys(models).length > 0 || apis || customAPIs) {
    registerRoutes(fastify, appConfig);
  }
  await fastify.ready();
  return fastify;
}
