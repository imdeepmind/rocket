import * as fs from 'fs';
import * as path from 'path';

import {expect, test} from '@playwright/test';
import mysql from 'mysql2/promise';
import {Pool} from 'pg';

import migrateDatabase from '@/migrator';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {createDatabaseClient} from '@/lib/database/client';

import {AppConfigInput, DBEngine} from '@/interfaces/config';

import {DEFAULT_TEST_MYSQL_URL, DEFAULT_TEST_PG_URL} from './helpers/constants';
import {createE2EServer, E2EServer} from './helpers/server';

function createTempMigrationDir(): {
  dir: string;
  writeFile: (relativePath: string, content: string) => void;
  cleanup: () => void;
} {
  const dir = path.resolve(
    process.cwd(),
    'e2e/.data',
    `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(dir, {recursive: true});

  return {
    dir,
    writeFile: (relativePath: string, content: string) => {
      const fullPath = path.join(dir, relativePath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, {recursive: true});
      }
      fs.writeFileSync(fullPath, content, 'utf8');
    },
    cleanup: () => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, {recursive: true, force: true});
      }
    },
  };
}

function createModelConfig(
  engine: DBEngine,
  connectionUrl: string,
  modelName: string,
  migrationsDir?: string,
  dangerouslyAllowDDL?: boolean,
): AppConfigInput {
  return {
    application: {
      name: `Rocket E2E - Migrations ${engine}`,
      logLevel: 'warn',
    },
    infrastructure: {
      database: {
        engine,
        connection: {url: connectionUrl},
        migrations: migrationsDir
          ? {
              directory: migrationsDir,
              dangerouslyAllowDDL,
            }
          : undefined,
      },
    },
    data: {
      models: {
        [modelName]: {
          fields: {
            id: {
              type: 'integer',
              primaryKey: true,
              autoIncrement: true,
              nullable: false,
              apis: ['index', 'edit', 'delete'],
            },
            title: {
              type: 'string',
              nullable: false,
            },
            content: {
              type: 'string',
              nullable: true,
            },
          },
        },
      },
    },
    apis: {},
  };
}

// ---------------------------------------------------------------------------
// SQLite Custom Migrations Test Suite
// ---------------------------------------------------------------------------

test.describe('SQLite Custom Migrations', () => {
  test('Applies custom data migrations and seeds records reachable via HTTP API', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_seed_articles.sql',
      `INSERT INTO articles (title, content) VALUES
        ('SQLite Article 1', 'Content for first article'),
        ('SQLite Article 2', 'Content for second article');`,
    );

    const config = createModelConfig(
      'sqlite',
      './e2e/.data/test.db',
      'articles',
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get('/api/v1/articles/');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data[0].title).toBe('SQLite Article 1');
      expect(body.data.data[1].title).toBe('SQLite Article 2');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
    }
  });

  test('Blocks DDL migrations by default without --dangerously-allow-ddl', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_create_table.sql',
      'CREATE TABLE custom_tags (id TEXT PRIMARY KEY, label TEXT);',
    );

    const config = createModelConfig(
      'sqlite',
      './e2e/.data/test.db',
      'articles',
      temp.dir,
    );

    try {
      await expect(createE2EServer(config)).rejects.toThrow(
        /Migration "001_create_table\.sql" contains non-DML\/DDL statements.*Use --dangerously-allow-ddl/i,
      );
    } finally {
      temp.cleanup();
    }
  });

  test('Allows idempotent DDL migrations when dangerouslyAllowDdl is true', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_idempotent_ddl.sql',
      'CREATE TABLE IF NOT EXISTS custom_tags (id TEXT PRIMARY KEY, label TEXT);',
    );

    const config = createModelConfig(
      'sqlite',
      './e2e/.data/test.db',
      'articles',
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config, {dangerouslyAllowDdl: true});

      const res = await server.request.get('/api/v1/articles/');
      expect(res.status()).toBe(200);

      // Verify custom table exists by querying the database directly
      const db = server.app.db;
      const result = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_tags';",
      );
      expect(result.rows).toHaveLength(1);
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
    }
  });

  test('Re-runs DDL migrations while skipping data migrations on subsequent runs', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_seed.sql',
      "INSERT INTO articles (title, content) VALUES ('Seeded Once', 'Content Body');",
    );
    temp.writeFile(
      '002_ddl.sql',
      'CREATE TABLE IF NOT EXISTS custom_flags (flag TEXT PRIMARY KEY);',
    );

    const config = createModelConfig(
      'sqlite',
      './e2e/.data/test.db',
      'articles',
      temp.dir,
      true,
    );

    let server: E2EServer | undefined;
    try {
      // First startup: runs migrations (001_seed.sql and 002_ddl.sql are executed)
      server = await createE2EServer(config, {dangerouslyAllowDdl: true});

      // Second migration run on active database: 001_seed is skipped, 002_ddl re-executes idempotently
      await migrateDatabase(server.app.appConfig);

      const res = await server.request.get('/api/v1/articles/');
      expect(res.status()).toBe(200);

      const body = await res.json();
      // Should only contain 1 item, proving 001_seed.sql was NOT executed twice
      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].title).toBe('Seeded Once');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
    }
  });

  test('Detects checksum mismatch and throws error if executed migration is modified', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_seed.sql',
      "INSERT INTO articles (title, content) VALUES ('Original Title', 'Original Content');",
    );

    const dbFile = path.resolve(
      process.cwd(),
      'e2e/.data',
      `test-checksum-${Date.now()}.db`,
    );

    const config = createModelConfig('sqlite', dbFile, 'articles', temp.dir);

    try {
      const resolvedConfig = resolveAndValidateConfig(config, 'dev');

      // First run applies 001_seed.sql
      await migrateDatabase(resolvedConfig);

      // Modify the migration file after it has already run
      temp.writeFile(
        '001_seed.sql',
        "INSERT INTO articles (title, content) VALUES ('TAMPERED Title', 'Tampered Content');",
      );

      // Second run must fail with checksum mismatch
      await expect(migrateDatabase(resolvedConfig)).rejects.toThrow(
        /Migration "001_seed\.sql" has been executed previously with a different checksum\. Altering executed migrations is not allowed\./i,
      );
    } finally {
      temp.cleanup();
      if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
      }
    }
  });

  test('Rolls back multi-statement migration file atomically on transaction failure', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_failing_atomic.sql',
      `INSERT INTO articles (title, content) VALUES ('Will Rollback', 'Temp');
       INSERT INTO nonexistent_broken_table (col) VALUES ('fail');`,
    );

    const dbFile = path.resolve(
      process.cwd(),
      'e2e/.data',
      `test-atomic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`,
    );

    const config = createModelConfig('sqlite', dbFile, 'articles', temp.dir);

    try {
      const resolvedConfig = resolveAndValidateConfig(config, 'dev');

      // Migration must fail because of the nonexistent table in statement 2
      await expect(migrateDatabase(resolvedConfig)).rejects.toThrow(
        /Migration "001_failing_atomic\.sql" failed/i,
      );

      // Verify the transaction was rolled back and the first INSERT was reverted
      const db = createDatabaseClient({engine: 'sqlite', url: dbFile});
      try {
        const result = await db.query('SELECT * FROM articles;');
        expect(result.rows).toHaveLength(0);
      } finally {
        await db.close();
      }
    } finally {
      temp.cleanup();
      if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
      }
    }
  });

  test('Executes sqlite engine subdirectory and skips postgres and mysql subdirectories', async () => {
    const temp = createTempMigrationDir();
    temp.writeFile(
      '001_common.sql',
      "INSERT INTO articles (title, content) VALUES ('Common Title', 'Common Content');",
    );
    temp.writeFile(
      'sqlite/002_sqlite.sql',
      "INSERT INTO articles (title, content) VALUES ('SQLite Specific', 'SQLite Content');",
    );
    temp.writeFile(
      'postgres/003_pg.sql',
      "INSERT INTO articles (title, content) VALUES ('PG Specific', 'PG Content');",
    );
    temp.writeFile(
      'mysql/004_mysql.sql',
      "INSERT INTO articles (title, content) VALUES ('MySQL Specific', 'MySQL Content');",
    );

    const config = createModelConfig(
      'sqlite',
      './e2e/.data/test.db',
      'articles',
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get('/api/v1/articles/');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.data).toHaveLength(2);

      const titles = body.data.data.map((r: {title: string}) => r.title);
      expect(titles).toContain('Common Title');
      expect(titles).toContain('SQLite Specific');
      expect(titles).not.toContain('PG Specific');
      expect(titles).not.toContain('MySQL Specific');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// PostgreSQL Custom Migrations Test Suite
// ---------------------------------------------------------------------------

test.describe.serial('PostgreSQL Custom Migrations', () => {
  const pgPool = new Pool({connectionString: DEFAULT_TEST_PG_URL});
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  test.afterAll(async () => {
    await pgPool.end().catch(() => {});
  });

  test('Applies custom data migrations on PostgreSQL and serves via HTTP API', async () => {
    const tableName = `articles_pg_${runId}_seed`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_seed_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES
        ('PG Article 1', 'PG Body 1'),
        ('PG Article 2', 'PG Body 2');`,
    );

    const config = createModelConfig(
      'postgres',
      DEFAULT_TEST_PG_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data[0].title).toBe('PG Article 1');
      expect(body.data.data[1].title).toBe('PG Article 2');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      await pgPool
        .query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`)
        .catch(() => {});
      await pgPool
        .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
        .catch(() => {});
    }
  });

  test('Blocks DDL migration on PostgreSQL without dangerouslyAllowDdl', async () => {
    const tableName = `articles_pg_${runId}_ddl_guard`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_create_${runId}.sql`,
      `CREATE TABLE custom_pg_tags_${runId} (id SERIAL PRIMARY KEY, name VARCHAR(50));`,
    );

    const config = createModelConfig(
      'postgres',
      DEFAULT_TEST_PG_URL,
      tableName,
      temp.dir,
    );

    try {
      await expect(createE2EServer(config)).rejects.toThrow(
        /contains non-DML\/DDL statements.*Use --dangerously-allow-ddl/i,
      );
    } finally {
      temp.cleanup();
      await pgPool
        .query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`)
        .catch(() => {});
      await pgPool
        .query(`DROP TABLE IF EXISTS custom_pg_tags_${runId} CASCADE;`)
        .catch(() => {});
    }
  });

  test('Allows idempotent DDL on PostgreSQL with dangerouslyAllowDdl', async () => {
    const tableName = `articles_pg_${runId}_ddl_allow`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_idempotent_${runId}.sql`,
      `CREATE TABLE IF NOT EXISTS custom_pg_tags_${runId} (id SERIAL PRIMARY KEY, name VARCHAR(50));`,
    );

    const config = createModelConfig(
      'postgres',
      DEFAULT_TEST_PG_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config, {dangerouslyAllowDdl: true});

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const tableCheck = await pgPool.query(
        `SELECT to_regclass('public.custom_pg_tags_${runId}') as reg;`,
      );
      expect(tableCheck.rows[0].reg).not.toBeNull();
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      await pgPool
        .query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`)
        .catch(() => {});
      await pgPool
        .query(`DROP TABLE IF EXISTS custom_pg_tags_${runId} CASCADE;`)
        .catch(() => {});
      await pgPool
        .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
        .catch(() => {});
    }
  });

  test('Executes postgres engine subdirectory and skips mysql and sqlite on PostgreSQL', async () => {
    const tableName = `articles_pg_${runId}_engine_dir`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_common_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('Common PG', 'Common');`,
    );
    temp.writeFile(
      `postgres/002_pg_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('Postgres Only', 'PG Subdir');`,
    );
    temp.writeFile(
      `mysql/003_mysql_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('MySQL Only', 'MySQL Subdir');`,
    );
    temp.writeFile(
      `sqlite/004_sqlite_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('SQLite Only', 'SQLite Subdir');`,
    );

    const config = createModelConfig(
      'postgres',
      DEFAULT_TEST_PG_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.data).toHaveLength(2);

      const titles = body.data.data.map((r: {title: string}) => r.title);
      expect(titles).toContain('Common PG');
      expect(titles).toContain('Postgres Only');
      expect(titles).not.toContain('MySQL Only');
      expect(titles).not.toContain('SQLite Only');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      await pgPool
        .query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`)
        .catch(() => {});
      await pgPool
        .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
        .catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// MySQL Custom Migrations Test Suite
// ---------------------------------------------------------------------------

test.describe.serial('MySQL Custom Migrations', () => {
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  async function getMysqlConnection(): Promise<mysql.Connection> {
    return mysql.createConnection(DEFAULT_TEST_MYSQL_URL);
  }

  test('Applies custom data migrations on MySQL and serves via HTTP API', async () => {
    const tableName = `articles_my_${runId}_seed`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_seed_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES
        ('MySQL Article 1', 'MySQL Body 1'),
        ('MySQL Article 2', 'MySQL Body 2');`,
    );

    const config = createModelConfig(
      'mysql',
      DEFAULT_TEST_MYSQL_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data[0].title).toBe('MySQL Article 1');
      expect(body.data.data[1].title).toBe('MySQL Article 2');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      const conn = await getMysqlConnection().catch(() => null);
      if (conn) {
        await conn.query(`DROP TABLE IF EXISTS ${tableName};`).catch(() => {});
        await conn
          .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
          .catch(() => {});
        await conn.end().catch(() => {});
      }
    }
  });

  test('Blocks DDL migration on MySQL without dangerouslyAllowDdl', async () => {
    const tableName = `articles_my_${runId}_ddl_guard`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_create_${runId}.sql`,
      `CREATE TABLE custom_my_tags_${runId} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));`,
    );

    const config = createModelConfig(
      'mysql',
      DEFAULT_TEST_MYSQL_URL,
      tableName,
      temp.dir,
    );

    try {
      await expect(createE2EServer(config)).rejects.toThrow(
        /contains non-DML\/DDL statements.*Use --dangerously-allow-ddl/i,
      );
    } finally {
      temp.cleanup();
      const conn = await getMysqlConnection().catch(() => null);
      if (conn) {
        await conn.query(`DROP TABLE IF EXISTS ${tableName};`).catch(() => {});
        await conn
          .query(`DROP TABLE IF EXISTS custom_my_tags_${runId};`)
          .catch(() => {});
        await conn.end().catch(() => {});
      }
    }
  });

  test('Allows idempotent DDL on MySQL with dangerouslyAllowDdl', async () => {
    const tableName = `articles_my_${runId}_ddl_allow`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_idempotent_${runId}.sql`,
      `CREATE TABLE IF NOT EXISTS custom_my_tags_${runId} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));`,
    );

    const config = createModelConfig(
      'mysql',
      DEFAULT_TEST_MYSQL_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config, {dangerouslyAllowDdl: true});

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const conn = await getMysqlConnection();
      try {
        const [rows] = await conn.query(
          `SHOW TABLES LIKE 'custom_my_tags_${runId}';`,
        );
        expect(Array.isArray(rows) && rows.length > 0).toBe(true);
      } finally {
        await conn.end().catch(() => {});
      }
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      const conn = await getMysqlConnection().catch(() => null);
      if (conn) {
        await conn.query(`DROP TABLE IF EXISTS ${tableName};`).catch(() => {});
        await conn
          .query(`DROP TABLE IF EXISTS custom_my_tags_${runId};`)
          .catch(() => {});
        await conn
          .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
          .catch(() => {});
        await conn.end().catch(() => {});
      }
    }
  });

  test('Executes mysql engine subdirectory and skips postgres and sqlite on MySQL', async () => {
    const tableName = `articles_my_${runId}_engine_dir`;
    const temp = createTempMigrationDir();
    temp.writeFile(
      `001_common_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('Common MySQL', 'Common');`,
    );
    temp.writeFile(
      `mysql/002_mysql_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('MySQL Only', 'MySQL Subdir');`,
    );
    temp.writeFile(
      `postgres/003_pg_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('Postgres Only', 'PG Subdir');`,
    );
    temp.writeFile(
      `sqlite/004_sqlite_${runId}.sql`,
      `INSERT INTO ${tableName} (title, content) VALUES ('SQLite Only', 'SQLite Subdir');`,
    );

    const config = createModelConfig(
      'mysql',
      DEFAULT_TEST_MYSQL_URL,
      tableName,
      temp.dir,
    );

    let server: E2EServer | undefined;
    try {
      server = await createE2EServer(config);

      const res = await server.request.get(`/api/v1/${tableName}/`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.data).toHaveLength(2);

      const titles = body.data.data.map((r: {title: string}) => r.title);
      expect(titles).toContain('Common MySQL');
      expect(titles).toContain('MySQL Only');
      expect(titles).not.toContain('Postgres Only');
      expect(titles).not.toContain('SQLite Only');
    } finally {
      if (server) {
        await server.cleanup();
      }
      temp.cleanup();
      const conn = await getMysqlConnection().catch(() => null);
      if (conn) {
        await conn.query(`DROP TABLE IF EXISTS ${tableName};`).catch(() => {});
        await conn
          .query(`DELETE FROM _ross_migrations WHERE id LIKE '%${runId}%';`)
          .catch(() => {});
        await conn.end().catch(() => {});
      }
    }
  });
});
