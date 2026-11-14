import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import {Pool} from 'pg';

import {
  DiscoveredMigration,
  MigrationHistoryRecord,
  MigrationRunResult,
  RunMigrationsOptions,
} from '@/interfaces/migrations';

const POSTGRES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id VARCHAR(255) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  contains_ddl BOOLEAN NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const MYSQL_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id VARCHAR(255) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  contains_ddl BOOLEAN NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const SQLITE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _ross_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  contains_ddl INTEGER NOT NULL,
  executed_at TEXT DEFAULT (datetime('now'))
);
`;

const POSTGRES_INSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP);
`;

const POSTGRES_UPSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET checksum = EXCLUDED.checksum, executed_at = CURRENT_TIMESTAMP;
`;

const MYSQL_INSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP);
`;

const MYSQL_UPSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), executed_at = CURRENT_TIMESTAMP;
`;

const SQLITE_INSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, datetime('now'));
`;

const SQLITE_UPSERT_SQL = `
INSERT INTO _ross_migrations (id, checksum, contains_ddl, executed_at)
VALUES (?, ?, ?, datetime('now'))
ON CONFLICT (id) DO UPDATE SET checksum = excluded.checksum, executed_at = datetime('now');
`;

const SELECT_HISTORY_SQL =
  'SELECT id, checksum, contains_ddl, executed_at FROM _ross_migrations;';

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

async function runPostgresMigrations(
  migrations: DiscoveredMigration[],
  connectionUrl: string,
  dangerouslyAllowDDL: boolean,
): Promise<MigrationRunResult> {
  const pool = new Pool({connectionString: connectionUrl});
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query(POSTGRES_TABLE_SQL);
    const historyRes = await client.query(SELECT_HISTORY_SQL);
    const historyMap = new Map<string, MigrationHistoryRecord>();
    for (const row of historyRes.rows as MigrationHistoryRecord[]) {
      historyMap.set(row.id, {
        ...row,
        contains_ddl: Boolean(row.contains_ddl),
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

      await client.query('BEGIN');
      try {
        await client.query(migration.content);
        const recordSql = migration.containsDDL
          ? POSTGRES_UPSERT_SQL
          : POSTGRES_INSERT_SQL;
        await client.query(recordSql, [
          migration.id,
          migration.checksum,
          migration.containsDDL,
        ]);
        await client.query('COMMIT');
        applied.push(migration.id);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback failure if transaction aborted
        }
        throw new Error(
          `Migration "${migration.id}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {applied, skipped};
  } finally {
    client.release();
    await pool.end();
  }
}

async function runSqliteMigrations(
  migrations: DiscoveredMigration[],
  connectionUrl: string,
  dangerouslyAllowDDL: boolean,
): Promise<MigrationRunResult> {
  const sqlite = new Database(connectionUrl);
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    sqlite.exec(SQLITE_TABLE_SQL);
    const rows = sqlite.prepare(SELECT_HISTORY_SQL).all() as Array<{
      id: string;
      checksum: string;
      contains_ddl: number | boolean;
      executed_at: string;
    }>;
    const historyMap = new Map<string, MigrationHistoryRecord>();
    for (const row of rows) {
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

      sqlite.exec('BEGIN');
      try {
        sqlite.exec(migration.content);
        const recordSql = migration.containsDDL
          ? SQLITE_UPSERT_SQL
          : SQLITE_INSERT_SQL;
        sqlite
          .prepare(recordSql)
          .run(migration.id, migration.checksum, migration.containsDDL ? 1 : 0);
        sqlite.exec('COMMIT');
        applied.push(migration.id);
      } catch (err) {
        try {
          sqlite.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure if transaction aborted
        }
        throw new Error(
          `Migration "${migration.id}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {applied, skipped};
  } finally {
    sqlite.close();
  }
}

async function runMysqlMigrations(
  migrations: DiscoveredMigration[],
  connectionUrl: string,
  dangerouslyAllowDDL: boolean,
): Promise<MigrationRunResult> {
  const connection = await mysql.createConnection({
    uri: connectionUrl,
    multipleStatements: true,
  });
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await connection.query(MYSQL_TABLE_SQL);
    const [rows] = await connection.query(SELECT_HISTORY_SQL);
    const historyMap = new Map<string, MigrationHistoryRecord>();
    for (const row of rows as Array<{
      id: string;
      checksum: string;
      contains_ddl: number | boolean;
      executed_at: unknown;
    }>) {
      historyMap.set(row.id, {
        id: row.id,
        checksum: row.checksum,
        contains_ddl: Boolean(row.contains_ddl),
        executed_at: row.executed_at as string | Date,
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

      await connection.beginTransaction();
      try {
        await connection.query(migration.content);
        const recordSql = migration.containsDDL
          ? MYSQL_UPSERT_SQL
          : MYSQL_INSERT_SQL;
        await connection.query(recordSql, [
          migration.id,
          migration.checksum,
          migration.containsDDL,
        ]);
        await connection.commit();
        applied.push(migration.id);
      } catch (err) {
        try {
          await connection.rollback();
        } catch {
          // Ignore rollback failure if transaction aborted
        }
        throw new Error(
          `Migration "${migration.id}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {applied, skipped};
  } finally {
    await connection.end();
  }
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

  switch (engine) {
    case 'postgres':
      return runPostgresMigrations(
        migrations,
        connectionUrl,
        dangerouslyAllowDDL,
      );
    case 'sqlite':
      return runSqliteMigrations(
        migrations,
        connectionUrl,
        dangerouslyAllowDDL,
      );
    case 'mysql':
      return runMysqlMigrations(migrations, connectionUrl, dangerouslyAllowDDL);
    default:
      throw new Error(`Unsupported database engine "${engine as string}".`);
  }
}
