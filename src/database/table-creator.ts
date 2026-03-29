import SQL from 'sql-template-strings';

import { DatabaseQuery } from '../types';
import { ModelConfig, DBEngine } from '../schema/config';

export async function createTables(
  db: DatabaseQuery,
  models: ModelConfig[],
  engine: DBEngine,
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
) {
  const seenTableNames = new Set<string>();

  for (const model of models) {
    if (seenTableNames.has(model.name)) {
      throw new Error(`Duplicate table name found in config: ${model.name}`);
    }
    seenTableNames.add(model.name);

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(model.name)) {
      throw new Error(`Invalid table name: ${model.name}`);
    }

    // Check if table exists
    let tableExists = false;
    if (engine === 'pg') {
      const res = await db.query<string, { exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [model.name]
      );
      tableExists = res[0].exists;
    } else {
      const res = await db.query<string, { count: number }>(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=$1",
        [model.name]
      );
      tableExists = res[0].count > 0;
    }

    if (tableExists) {
      logger.info(`Table "${model.name}" already exists, skipping creation.`);
      continue;
    }

    logger.info(`Creating table "${model.name}"...`);

    const statement = SQL`CREATE TABLE `.append(`"${model.name}"`).append(' (\n  ');
    const columnDefs: string[] = [];

    for (const field of model.fields) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        throw new Error(`Invalid column name: ${field.name}`);
      }

      let def = `"${field.name}" `;
      let typeStr = '';

      if (field.primaryKey) {
        if (engine === 'pg') {
          typeStr = 'SERIAL PRIMARY KEY';
        } else {
          typeStr = 'INTEGER PRIMARY KEY AUTOINCREMENT';
        }
      } else {
        switch (field.type) {
          case 'integer':
            typeStr = 'INTEGER';
            break;
          case 'string':
            typeStr = engine === 'pg' ? 'VARCHAR(255)' : 'TEXT';
            break;
          case 'text':
            typeStr = 'TEXT';
            break;
          case 'boolean':
            typeStr = 'BOOLEAN';
            break;
          case 'datetime':
            typeStr = engine === 'pg' ? 'TIMESTAMP' : 'DATETIME';
            break;
          default:
            throw new Error(`Unknown mapping for type: ${field.type}`);
        }

        if (field.nullable === false) {
          typeStr += ' NOT NULL';
        }
        if (field.unique) {
          typeStr += ' UNIQUE';
        }
        if (field.default !== undefined) {
          const defValue = typeof field.default === 'string' ? `'${field.default}'` : field.default;
          typeStr += ` DEFAULT ${defValue}`;
        }
      }

      def += typeStr;
      columnDefs.push(def);
    }

    statement.append(columnDefs.join(',\n  '));
    statement.append('\n);');

    // Using sql-template-strings output
    await db.query(statement.sql, statement.values);
    logger.info(`Table "${model.name}" created successfully.`);
  }
}
