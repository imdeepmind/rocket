import SQL from 'sql-template-strings';

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
      const statement = SQL`CREATE `;
      if (index.unique) {
        statement.append('UNIQUE ');
      }
      statement
        .append('INDEX IF NOT EXISTS ')
        .append(`"${index.name}"`)
        .append(' ON ')
        .append(`"${model.name}"`)
        .append(` (${columnList});`);

      // Check if index already exists
      let indexExists = false;
      if (engine === 'pg') {
        const query = SQL`SELECT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = ${index.name})`;
        const res = await db.query<string, { exists: boolean }>(query.sql, query.values);
        indexExists = res[0].exists;
      } else {
        const query = SQL`SELECT count(*) as count FROM sqlite_master WHERE type='index' AND name=${index.name}`;
        const res = await db.query<string, { count: number }>(query.sql, query.values);
        indexExists = res[0].count > 0;
      }

      if (indexExists) {
        logger.info(`Index "${index.name}" on table "${model.name}" already exists, skipping.`);
        continue;
      }

      logger.info(
        `Creating ${index.unique ? 'unique ' : ''}index "${index.name}" on table "${model.name}" (${index.columns.join(', ')})...`
      );
      await db.query(statement.sql, statement.values);
      logger.info(`Index "${index.name}" created successfully.`);
    }
  }
}
