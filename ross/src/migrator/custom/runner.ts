import {createDatabaseClient} from '@/lib/database/client';

import {DBEngine} from '@/interfaces/config';
import {
  DiscoveredMigration,
  MigrationHistoryRecord,
  MigrationRunResult,
  RunMigrationsOptions,
} from '@/interfaces/migrations';

const TABLE_SQL: Record<DBEngine, string> = {
  postgres: `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id VARCHAR(255) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  contains_ddl BOOLEAN NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`,
  mysql: `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id VARCHAR(255) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  contains_ddl BOOLEAN NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
  sqlite: `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  contains_ddl INTEGER NOT NULL,
  executed_at TEXT DEFAULT (datetime('now'))
);
`,
};

const INSERT_SQL: Record<DBEngine, string> = {
  postgres: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP);
`,
  mysql: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP);
`,
  sqlite: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, datetime('now'));
`,
};

const UPSERT_SQL: Record<DBEngine, string> = {
  postgres: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET checksum = EXCLUDED.checksum, executed_at = CURRENT_TIMESTAMP;
`,
  mysql: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), executed_at = CURRENT_TIMESTAMP;
`,
  sqlite: `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, datetime('now'))
ON CONFLICT (id) DO UPDATE SET checksum = excluded.checksum, executed_at = datetime('now');
`,
};

const SELECT_HISTORY_SQL =
  'SELECT id, checksum, contains_ddl, executed_at FROM _ross_migrations;';

function getHistoryParams(
  engine: DBEngine,
  migration: DiscoveredMigration,
): unknown[] {
  const containsDdlVal =
    engine === 'sqlite'
      ? migration.containsDDL
        ? 1
        : 0
      : migration.containsDDL;
  return [migration.id, migration.checksum, containsDdlVal];
}

/**
 * Validates whether a migration should be executed or skipped based on history,
 * and enforces checksum integrity on previously executed data migrations.
 */
function shouldExecuteMigration(
  migration: DiscoveredMigration,
  historyMap: Map<string, MigrationHistoryRecord>,
  dangerouslyAllowDDL: boolean,
): boolean {
  if (migration.containsDDL) {
    if (!dangerouslyAllowDDL) {
      throw new Error(
        `Migration "${migration.id}" contains non-DML/DDL statements. Custom migrations only permit data operations by default. Use --dangerously-allow-ddl to allow this at your own risk.`,
      );
    }
    return true;
  }

  const existing = historyMap.get(migration.id);
  if (!existing) {
    return true;
  }

  if (existing.checksum === migration.checksum) {
    return false;
  }

  throw new Error(
    `Migration "${migration.id}" has been executed previously with a different checksum. Altering executed migrations is not allowed.`,
  );
}

/**
 * Executes discovered custom migrations within driver-specific transactions,
 * tracks execution state in the _ross_migrations history table, and skips
 * previously executed migrations.
 */
export async function runCustomMigrations(
  options: RunMigrationsOptions,
): Promise<MigrationRunResult> {
  const {
    migrations,
    engine,
    connectionUrl,
    dangerouslyAllowDDL = false,
  } = options;

  const tableSql = TABLE_SQL[engine];
  if (!tableSql) {
    throw new Error(`Unsupported database engine "${engine as string}".`);
  }

  const db = createDatabaseClient({
    engine,
    url: connectionUrl,
    allowDdl: true,
    multipleStatements: true,
  });

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await db.query(tableSql);
    const historyRes =
      await db.query<MigrationHistoryRecord>(SELECT_HISTORY_SQL);
    const historyMap = new Map<string, MigrationHistoryRecord>();
    for (const row of historyRes.rows) {
      historyMap.set(row.id, {
        id: row.id,
        checksum: row.checksum,
        contains_ddl: Boolean(row.contains_ddl),
        executed_at: row.executed_at,
      });
    }

    for (const migration of migrations) {
      const execute = shouldExecuteMigration(
        migration,
        historyMap,
        dangerouslyAllowDDL,
      );
      if (!execute) {
        skipped.push(migration.id);
        continue;
      }

      const tx = await db.beginTransaction();
      try {
        await tx.query(migration.content);
        const recordSql = migration.containsDDL
          ? UPSERT_SQL[engine]
          : INSERT_SQL[engine];
        const params = getHistoryParams(engine, migration);
        await tx.query(recordSql, params);
        await tx.commit();
        applied.push(migration.id);
      } catch (err) {
        try {
          await tx.rollback();
        } catch {
          // Ignore rollback failure if transaction aborted
        }
        throw new Error(
          `Migration "${migration.id}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        tx.release();
      }
    }

    return {applied, skipped};
  } finally {
    await db.close();
  }
}
