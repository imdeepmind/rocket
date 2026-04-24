import Fastify, {FastifyInstance} from 'fastify';

import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerModelRoutes} from '@/routes';

import {ApisConfig, DatabaseConfig, ModelConfig} from '@/schema/config';

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
): Promise<FastifyInstance> {
  const fastify = Fastify();
  await fastify.register(databasePlugin, dbConfig);
  await fastify.register(responsePlugin);
  if (models.length > 0 || apis) {
    registerModelRoutes(fastify, models, apis);
  }
  await fastify.ready();
  return fastify;
}
