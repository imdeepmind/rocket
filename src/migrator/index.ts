import { ModelConfig } from '../schema/config';
import getCurrentStateOfDb from './get-state';
import convertConfigToDrizzle from './convert-config-to-drizzle';
import generateMigrationScript from './generate-migration';
import applyMigration from './apply-migration';

const migrateDatabase = (config: ModelConfig[]) => {
  // get the current state of db
  const currentState = getCurrentStateOfDb();
  // convert config to drizzle schema
  const drizzleSchema = convertConfigToDrizzle(config);
  // compare the two and generate the migration
  const migration = generateMigrationScript(currentState, drizzleSchema);
  // apply the migration
  applyMigration(migration);
};

export default migrateDatabase;
