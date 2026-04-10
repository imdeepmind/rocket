import { AppConfig } from '../schema/config';
import getCurrentStateOfDb from './get-state';
import convertConfigToDrizzle from './convert-config-to-drizzle';
import generateMigrationScript from './generate-migration';
import applyMigration from './apply-migration';
import { FastifyInstance } from 'fastify';

const migrateDatabase = (app: FastifyInstance, config: AppConfig) => {
  const engine = config.database.engine;
  const models = config.models;

  // get the current state of db
  const currentState = getCurrentStateOfDb(app, engine);

  // convert config to drizzle schema
  const drizzleSchema = convertConfigToDrizzle(engine, models);
  console.log({ drizzleSchema });

  // compare the two and generate the migration
  const migration = generateMigrationScript(currentState, drizzleSchema);

  // apply the migration
  applyMigration(migration);
};

export default migrateDatabase;
