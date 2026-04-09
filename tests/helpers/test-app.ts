import Fastify, { FastifyInstance } from 'fastify';
import databasePlugin from '../../src/plugin/database';
import responsePlugin from '../../src/plugin/response';
import { DatabaseConfig, ModelConfig } from '../../src/schema/config';
import { registerModelRoutes } from '../../src/routes';

export const mockModels: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'integer', primaryKey: true },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
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
  models: ModelConfig[] = []
): Promise<FastifyInstance> {
  const fastify = Fastify();
  await fastify.register(databasePlugin, dbConfig);
  await fastify.register(responsePlugin);
  if (models.length > 0) {
    registerModelRoutes(fastify, models);
  }
  await fastify.ready();
  return fastify;
}
