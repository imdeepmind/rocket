import Fastify, {FastifyInstance} from 'fastify';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import webhookPlugin from '@/plugin/webhook';

import {registerRoutes} from '@/routes';

import {
  ApisConfig,
  AppConfig,
  AuthConfig,
  CustomAPIConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

export const mockModels: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {name: 'name', type: 'string'},
      {name: 'email', type: 'string'},
    ],
  },
];

export const pgConfig: DatabaseConfig = {
  engine: 'pg',
  connection: {
    urlOrPath: 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
};

export const sqliteConfig: DatabaseConfig = {
  engine: 'sqlite',
  connection: {
    urlOrPath: ':memory:',
  },
};

export async function createTestApp(
  dbConfig: DatabaseConfig,
  models: ModelConfig[] = [],
  apis?: ApisConfig,
  customAPIs?: CustomAPIConfig,
  auth?: AuthConfig,
): Promise<FastifyInstance> {
  const appConfig: AppConfig = {
    application: {logLevel: 'error'},
    swagger: {
      enabled: false,
      basePath: '/docs',
      info: {title: 'Test', description: 'Test', version: '1.0.0'},
    },
    database: dbConfig,
    models,
    apis,
    customAPIs,
    auth,
  };

  const fastify = Fastify();
  fastify.appConfig = appConfig;

  await fastify.register(databasePlugin, dbConfig);
  await fastify.register(responsePlugin);
  await fastify.register(sspPlugin);
  await fastify.register(webhookPlugin);
  await fastify.register(authPlugin);

  if (models.length > 0 || apis || customAPIs) {
    registerRoutes(fastify, appConfig);
  }
  await fastify.ready();
  return fastify;
}
