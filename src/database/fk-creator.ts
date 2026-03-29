import { DatabaseQuery } from '../types';
import { ModelConfig, DBEngine } from '../schema/config';

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(value: string, label: string) {
  if (!VALID_IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export async function createForeignKeys(
  db: DatabaseQuery,
  models: ModelConfig[],
  engine: DBEngine,
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
) {
  for (const model of models) {
    if (!model.foreignKeys || model.foreignKeys.length === 0) continue;

    for (const fk of model.foreignKeys) {
      validateIdentifier(fk.name, 'foreign key name');
      validateIdentifier(model.name, 'table name');
      validateIdentifier(fk.referenceTable, 'reference table name');
      for (const col of fk.columns) {
        validateIdentifier(col, `column name in FK "${fk.name}"`);
      }
      for (const col of fk.referenceColumns) {
        validateIdentifier(col, `reference column name in FK "${fk.name}"`);
      }

      // Check if constraint already exists
      let fkExists = false;
      if (engine === 'pg') {
        const res = await db.query<string, { exists: boolean }>(
          "SELECT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = $1 AND constraint_type = 'FOREIGN KEY')",
          [fk.name]
        );
        fkExists = res[0].exists;
      } else {
        // SQLite doesn't support ALTER TABLE ADD CONSTRAINT for FKs.
        // FKs must be defined at table creation time in SQLite.
        logger.warn(
          `SQLite does not support adding foreign keys via ALTER TABLE. FK "${fk.name}" on "${model.name}" skipped.`
        );
        continue;
      }

      if (fkExists) {
        logger.info(`Foreign key "${fk.name}" on table "${model.name}" already exists, skipping.`);
        continue;
      }

      const columnList = fk.columns.map((c) => `"${c}"`).join(', ');
      const refColumnList = fk.referenceColumns.map((c) => `"${c}"`).join(', ');

      let sql = `ALTER TABLE "${model.name}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY (${columnList}) REFERENCES "${fk.referenceTable}" (${refColumnList})`;

      if (fk.onDelete) {
        sql += ` ON DELETE ${fk.onDelete}`;
      }
      if (fk.onUpdate) {
        sql += ` ON UPDATE ${fk.onUpdate}`;
      }

      sql += ';';

      logger.info(
        `Creating foreign key "${fk.name}" on "${model.name}" referencing "${fk.referenceTable}" (${fk.referenceColumns.join(', ')})...`
      );
      await db.query(sql);
      logger.info(`Foreign key "${fk.name}" created successfully.`);
    }
  }
}
