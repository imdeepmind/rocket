import { DatabaseQuery } from '../types';
import { ModelConfig, DBEngine } from '../schema/config';

export async function createIndexes(
  db: DatabaseQuery,
  models: ModelConfig[],
  engine: DBEngine,
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
) {
  for (const model of models) {
    if (!model.indexes || model.indexes.length === 0) continue;

    for (const index of model.indexes) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(index.name)) {
        throw new Error(`Invalid index name: ${index.name}`);
      }
      for (const col of index.columns) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
          throw new Error(`Invalid column name in index "${index.name}": ${col}`);
        }
      }

      const columnList = index.columns.map((c) => `"${c}"`).join(', ');
      const statement = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${model.name}" (${columnList});`;

      // Check if index already exists
      let indexExists = false;
      if (engine === 'pg') {
        const query =
          "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1)";
        const res = await db.query<{ exists: boolean }>(query, [index.name]);
        indexExists = res[0].exists;
      } else {
        const query = "SELECT count(*) as count FROM sqlite_master WHERE type='index' AND name=$1";
        const res = await db.query<{ count: number }>(query, [index.name]);
        indexExists = res[0].count > 0;
      }

      if (indexExists) {
        logger.info(`Index "${index.name}" on table "${model.name}" already exists, skipping.`);
        continue;
      }

      logger.info(
        `Creating ${index.unique ? 'unique ' : ''}index "${index.name}" on table "${model.name}" (${index.columns.join(', ')})...`
      );
      await db.query(statement);
      logger.info(`Index "${index.name}" created successfully.`);
    }
  }
}
