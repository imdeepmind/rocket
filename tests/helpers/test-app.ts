import Fastify, {FastifyInstance} from 'fastify';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerRoutes} from '@/routes';

import {
  ApisConfig,
  AppConfig,
  AuthConfig,
  CustomAPIConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/schema/config';

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
  const fastify = Fastify();
  await fastify.register(databasePlugin, dbConfig);
  await fastify.register(responsePlugin);
  await fastify.register(authPlugin);
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

  if (models.length > 0 || apis || customAPIs) {
    registerRoutes(fastify, appConfig);
  }
  await fastify.ready();
  return fastify;
}
