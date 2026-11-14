import {beforeEach, describe, expect, it, vi} from 'vitest';

import {runCustomMigrations} from '@/migrator/custom/runner';

import {DiscoveredMigration} from '@/interfaces/migrations';

import {
  mysqlConnBeginTxMock,
  mysqlConnCommitMock,
  mysqlConnQueryMock,
  mysqlConnRollbackMock,
  mysqlCreateConnectionMock,
  mysqlEndMock,
  pgClientQueryMock,
  pgClientReleaseMock,
  pgConnectMock,
  pgEndMock,
  sqliteAllMock,
  sqliteCloseMock,
  sqliteExecMock,
  sqlitePrepareMock,
  sqliteRunMock,
} from '@tests/helpers/db-mocks';

describe('runCustomMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unsupported engine', () => {
    it('throws error for unsupported engine', async () => {
      await expect(
        runCustomMigrations({
          migrations: [],
          engine: 'oracle' as never,
          connectionUrl: 'oracle://localhost:1521/db',
        }),
      ).rejects.toThrow('Unsupported database engine "oracle".');
    });
  });

  describe('PostgreSQL', () => {
    it('provisions table, queries history, and applies pending data migration in a transaction', async () => {
      // 1. Table creation query resolves
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      // 2. Select history query resolves empty
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      // 3. BEGIN
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      // 4. Content query
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      // 5. History insert
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      // 6. COMMIT
      pgClientQueryMock.mockResolvedValueOnce({rows: []});

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Alice');",
        checksum: 'hash-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'postgres',
        connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
      });

      expect(result).toEqual({applied: ['01_init.sql'], skipped: []});
      expect(pgConnectMock).toHaveBeenCalledTimes(1);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _ross_migrations'),
      );
      expect(pgClientQueryMock).toHaveBeenCalledWith('BEGIN');
      expect(pgClientQueryMock).toHaveBeenCalledWith(migration.content);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _ross_migrations'),
        ['01_init.sql', 'hash-01', false],
      );
      expect(pgClientQueryMock).toHaveBeenCalledWith('COMMIT');
      expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      expect(pgEndMock).toHaveBeenCalledTimes(1);
    });

    it('skips already executed data migration with matching checksum', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: '01_init.sql',
            checksum: 'hash-01',
            contains_ddl: false,
            executed_at: new Date(),
          },
        ],
      });

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Alice');",
        checksum: 'hash-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'postgres',
        connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
      });

      expect(result).toEqual({applied: [], skipped: ['01_init.sql']});
      expect(pgClientQueryMock).not.toHaveBeenCalledWith('BEGIN');
      expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      expect(pgEndMock).toHaveBeenCalledTimes(1);
    });

    it('throws error when already executed migration has mismatched checksum', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: '01_init.sql',
            checksum: 'old-hash',
            contains_ddl: false,
            executed_at: new Date(),
          },
        ],
      });

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Alice');",
        checksum: 'new-hash',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'postgres',
          connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
        }),
      ).rejects.toThrow(
        'Migration "01_init.sql" has been executed previously with a different checksum. Altering executed migrations is not allowed.',
      );

      expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      expect(pgEndMock).toHaveBeenCalledTimes(1);
    });

    it('re-executes DDL migration on every run when dangerouslyAllowDDL is true with upsert', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: '02_view.sql',
            checksum: 'old-hash',
            contains_ddl: true,
            executed_at: new Date(),
          },
        ],
      });
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // BEGIN
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // Content
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // UPSERT
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // COMMIT

      const migration: DiscoveredMigration = {
        id: '02_view.sql',
        name: '02_view.sql',
        prefix: 2,
        filePath: '/path/02_view.sql',
        content: 'CREATE OR REPLACE VIEW active_users AS SELECT * FROM users;',
        checksum: 'new-hash',
        containsDDL: true,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'postgres',
        connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
        dangerouslyAllowDDL: true,
      });

      expect(result).toEqual({applied: ['02_view.sql'], skipped: []});
      expect(pgClientQueryMock).toHaveBeenCalledWith('BEGIN');
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
        ['02_view.sql', 'new-hash', true],
      );
      expect(pgClientQueryMock).toHaveBeenCalledWith('COMMIT');
    });

    it('rejects DDL migration when dangerouslyAllowDDL is false', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({rows: []});

      const migration: DiscoveredMigration = {
        id: '02_ddl.sql',
        name: '02_ddl.sql',
        prefix: 2,
        filePath: '/path/02_ddl.sql',
        content: 'CREATE TABLE extra (id INT);',
        checksum: 'hash-ddl',
        containsDDL: true,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'postgres',
          connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
          dangerouslyAllowDDL: false,
        }),
      ).rejects.toThrow(
        'Migration "02_ddl.sql" contains non-DML/DDL statements. Custom migrations only permit data operations by default. Use --dangerously-allow-ddl to allow this at your own risk.',
      );

      expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      expect(pgEndMock).toHaveBeenCalledTimes(1);
    });

    it('rolls back transaction on SQL execution error and stops further execution', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // Table
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // History
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // BEGIN
      pgClientQueryMock.mockRejectedValueOnce(new Error('Syntax error')); // Content fails
      pgClientQueryMock.mockResolvedValueOnce({rows: []}); // ROLLBACK

      const migration1: DiscoveredMigration = {
        id: '01_broken.sql',
        name: '01_broken.sql',
        prefix: 1,
        filePath: '/path/01_broken.sql',
        content: 'INVALID SQL;',
        checksum: 'hash-01',
        containsDDL: false,
      };

      const migration2: DiscoveredMigration = {
        id: '02_never.sql',
        name: '02_never.sql',
        prefix: 2,
        filePath: '/path/02_never.sql',
        content: 'SELECT 1;',
        checksum: 'hash-02',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration1, migration2],
          engine: 'postgres',
          connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
        }),
      ).rejects.toThrow('Migration "01_broken.sql" failed: Syntax error');

      expect(pgClientQueryMock).toHaveBeenCalledWith('ROLLBACK');
      expect(pgClientQueryMock).not.toHaveBeenCalledWith(migration2.content);
      expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      expect(pgEndMock).toHaveBeenCalledTimes(1);
    });

    it('handles rollback failure gracefully without masking the original error', async () => {
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockResolvedValueOnce({rows: []});
      pgClientQueryMock.mockRejectedValueOnce(new Error('Query error'));
      pgClientQueryMock.mockRejectedValueOnce(new Error('Rollback failed'));

      const migration: DiscoveredMigration = {
        id: '01_broken.sql',
        name: '01_broken.sql',
        prefix: 1,
        filePath: '/path/01_broken.sql',
        content: 'INVALID;',
        checksum: 'hash-01',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'postgres',
          connectionUrl: 'postgresql://user:pass@localhost:5432/testdb',
        }),
      ).rejects.toThrow('Migration "01_broken.sql" failed: Query error');
    });
  });

  describe('SQLite', () => {
    it('provisions table, queries history, and applies pending migration in a transaction', async () => {
      sqliteAllMock.mockReturnValueOnce([]);

      const migration: DiscoveredMigration = {
        id: '01_seed.sql',
        name: '01_seed.sql',
        prefix: 1,
        filePath: '/path/01_seed.sql',
        content: "INSERT INTO items (name) VALUES ('Widget');",
        checksum: 'hash-sqlite-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'sqlite',
        connectionUrl: ':memory:',
      });

      expect(result).toEqual({applied: ['01_seed.sql'], skipped: []});
      expect(sqliteExecMock).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _ross_migrations'),
      );
      expect(sqlitePrepareMock).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, checksum, contains_ddl'),
      );
      expect(sqliteExecMock).toHaveBeenCalledWith('BEGIN');
      expect(sqliteExecMock).toHaveBeenCalledWith(migration.content);
      expect(sqlitePrepareMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _ross_migrations'),
      );
      expect(sqliteRunMock).toHaveBeenCalledWith(
        '01_seed.sql',
        'hash-sqlite-01',
        0,
      );
      expect(sqliteExecMock).toHaveBeenCalledWith('COMMIT');
      expect(sqliteCloseMock).toHaveBeenCalledTimes(1);
    });

    it('skips already executed data migration with matching checksum', async () => {
      sqliteAllMock.mockReturnValueOnce([
        {
          id: '01_seed.sql',
          checksum: 'hash-sqlite-01',
          contains_ddl: 0,
          executed_at: '2026-01-01 00:00:00',
        },
      ]);

      const migration: DiscoveredMigration = {
        id: '01_seed.sql',
        name: '01_seed.sql',
        prefix: 1,
        filePath: '/path/01_seed.sql',
        content: "INSERT INTO items (name) VALUES ('Widget');",
        checksum: 'hash-sqlite-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'sqlite',
        connectionUrl: ':memory:',
      });

      expect(result).toEqual({applied: [], skipped: ['01_seed.sql']});
      expect(sqliteExecMock).not.toHaveBeenCalledWith('BEGIN');
      expect(sqliteCloseMock).toHaveBeenCalledTimes(1);
    });

    it('throws error when already executed migration has mismatched checksum', async () => {
      sqliteAllMock.mockReturnValueOnce([
        {
          id: '01_seed.sql',
          checksum: 'old-hash',
          contains_ddl: 0,
          executed_at: '2026-01-01 00:00:00',
        },
      ]);

      const migration: DiscoveredMigration = {
        id: '01_seed.sql',
        name: '01_seed.sql',
        prefix: 1,
        filePath: '/path/01_seed.sql',
        content: "INSERT INTO items (name) VALUES ('Widget');",
        checksum: 'new-hash',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'sqlite',
          connectionUrl: ':memory:',
        }),
      ).rejects.toThrow(
        'Migration "01_seed.sql" has been executed previously with a different checksum. Altering executed migrations is not allowed.',
      );
      expect(sqliteCloseMock).toHaveBeenCalledTimes(1);
    });

    it('re-executes DDL migration on every run when dangerouslyAllowDDL is true', async () => {
      sqliteAllMock.mockReturnValueOnce([
        {
          id: '02_view.sql',
          checksum: 'old-hash',
          contains_ddl: 1,
          executed_at: '2026-01-01 00:00:00',
        },
      ]);

      const migration: DiscoveredMigration = {
        id: '02_view.sql',
        name: '02_view.sql',
        prefix: 2,
        filePath: '/path/02_view.sql',
        content: 'CREATE VIEW items_view AS SELECT * FROM items;',
        checksum: 'new-hash',
        containsDDL: true,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'sqlite',
        connectionUrl: ':memory:',
        dangerouslyAllowDDL: true,
      });

      expect(result).toEqual({applied: ['02_view.sql'], skipped: []});
      expect(sqliteExecMock).toHaveBeenCalledWith('BEGIN');
      expect(sqliteExecMock).toHaveBeenCalledWith(migration.content);
      expect(sqlitePrepareMock).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
      );
      expect(sqliteRunMock).toHaveBeenCalledWith('02_view.sql', 'new-hash', 1);
      expect(sqliteExecMock).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back transaction on error and closes connection', async () => {
      sqliteAllMock.mockReturnValueOnce([]);
      sqliteExecMock.mockImplementation((sql: string) => {
        if (sql === 'INVALID SQL;') {
          throw new Error('SQLite syntax error');
        }
      });

      const migration: DiscoveredMigration = {
        id: '01_fail.sql',
        name: '01_fail.sql',
        prefix: 1,
        filePath: '/path/01_fail.sql',
        content: 'INVALID SQL;',
        checksum: 'hash-fail',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'sqlite',
          connectionUrl: ':memory:',
        }),
      ).rejects.toThrow('Migration "01_fail.sql" failed: SQLite syntax error');

      expect(sqliteExecMock).toHaveBeenCalledWith('ROLLBACK');
      expect(sqliteCloseMock).toHaveBeenCalledTimes(1);
    });

    it('handles rollback failure gracefully without masking the original error', async () => {
      sqliteAllMock.mockReturnValueOnce([]);
      sqliteExecMock.mockImplementation((sql: string) => {
        if (sql === 'INVALID SQL;') {
          throw new Error('SQLite execution error');
        }
        if (sql === 'ROLLBACK') {
          throw new Error('Cannot rollback - no transaction active');
        }
      });

      const migration: DiscoveredMigration = {
        id: '01_fail.sql',
        name: '01_fail.sql',
        prefix: 1,
        filePath: '/path/01_fail.sql',
        content: 'INVALID SQL;',
        checksum: 'hash-fail',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'sqlite',
          connectionUrl: ':memory:',
        }),
      ).rejects.toThrow(
        'Migration "01_fail.sql" failed: SQLite execution error',
      );
    });
  });

  describe('MySQL', () => {
    it('provisions table, queries history, and applies pending migration in a transaction', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // Table
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // History
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // Content
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // History insert

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Bob');",
        checksum: 'hash-mysql-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'mysql',
        connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
      });

      expect(result).toEqual({applied: ['01_init.sql'], skipped: []});
      expect(mysqlCreateConnectionMock).toHaveBeenCalledWith({
        uri: 'mysql://user:pass@localhost:3306/testdb',
        multipleStatements: true,
      });
      expect(mysqlConnQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _ross_migrations'),
      );
      expect(mysqlConnBeginTxMock).toHaveBeenCalledTimes(1);
      expect(mysqlConnQueryMock).toHaveBeenCalledWith(migration.content);
      expect(mysqlConnQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _ross_migrations'),
        ['01_init.sql', 'hash-mysql-01', false],
      );
      expect(mysqlConnCommitMock).toHaveBeenCalledTimes(1);
      expect(mysqlEndMock).toHaveBeenCalledTimes(1);
    });

    it('skips already executed data migration with matching checksum', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]);
      mysqlConnQueryMock.mockResolvedValueOnce([
        [
          {
            id: '01_init.sql',
            checksum: 'hash-mysql-01',
            contains_ddl: 0,
            executed_at: '2026-01-01 00:00:00',
          },
        ],
      ]);

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Bob');",
        checksum: 'hash-mysql-01',
        containsDDL: false,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'mysql',
        connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
      });

      expect(result).toEqual({applied: [], skipped: ['01_init.sql']});
      expect(mysqlConnBeginTxMock).not.toHaveBeenCalled();
      expect(mysqlEndMock).toHaveBeenCalledTimes(1);
    });

    it('throws error when already executed migration has mismatched checksum', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]);
      mysqlConnQueryMock.mockResolvedValueOnce([
        [
          {
            id: '01_init.sql',
            checksum: 'old-hash',
            contains_ddl: 0,
            executed_at: '2026-01-01 00:00:00',
          },
        ],
      ]);

      const migration: DiscoveredMigration = {
        id: '01_init.sql',
        name: '01_init.sql',
        prefix: 1,
        filePath: '/path/01_init.sql',
        content: "INSERT INTO users (name) VALUES ('Bob');",
        checksum: 'new-hash',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'mysql',
          connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
        }),
      ).rejects.toThrow(
        'Migration "01_init.sql" has been executed previously with a different checksum. Altering executed migrations is not allowed.',
      );

      expect(mysqlEndMock).toHaveBeenCalledTimes(1);
    });

    it('re-executes DDL migration on every run when dangerouslyAllowDDL is true with upsert', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]);
      mysqlConnQueryMock.mockResolvedValueOnce([
        [
          {
            id: '02_proc.sql',
            checksum: 'old-hash',
            contains_ddl: 1,
            executed_at: '2026-01-01 00:00:00',
          },
        ],
      ]);
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // Content
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // UPSERT

      const migration: DiscoveredMigration = {
        id: '02_proc.sql',
        name: '02_proc.sql',
        prefix: 2,
        filePath: '/path/02_proc.sql',
        content: 'CREATE PROCEDURE test_proc() BEGIN SELECT 1; END;',
        checksum: 'new-hash',
        containsDDL: true,
      };

      const result = await runCustomMigrations({
        migrations: [migration],
        engine: 'mysql',
        connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
        dangerouslyAllowDDL: true,
      });

      expect(result).toEqual({applied: ['02_proc.sql'], skipped: []});
      expect(mysqlConnBeginTxMock).toHaveBeenCalledTimes(1);
      expect(mysqlConnQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('ON DUPLICATE KEY UPDATE'),
        ['02_proc.sql', 'new-hash', true],
      );
      expect(mysqlConnCommitMock).toHaveBeenCalledTimes(1);
    });

    it('rolls back transaction on error and ends connection', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // Table
      mysqlConnQueryMock.mockResolvedValueOnce([[]]); // History
      mysqlConnQueryMock.mockRejectedValueOnce(new Error('MySQL query error')); // Content

      const migration: DiscoveredMigration = {
        id: '01_broken.sql',
        name: '01_broken.sql',
        prefix: 1,
        filePath: '/path/01_broken.sql',
        content: 'INVALID;',
        checksum: 'hash-broken',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'mysql',
          connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
        }),
      ).rejects.toThrow('Migration "01_broken.sql" failed: MySQL query error');

      expect(mysqlConnRollbackMock).toHaveBeenCalledTimes(1);
      expect(mysqlEndMock).toHaveBeenCalledTimes(1);
    });

    it('handles rollback failure gracefully without masking the original error', async () => {
      mysqlConnQueryMock.mockResolvedValueOnce([[]]);
      mysqlConnQueryMock.mockResolvedValueOnce([[]]);
      mysqlConnQueryMock.mockRejectedValueOnce(new Error('MySQL query error'));
      mysqlConnRollbackMock.mockRejectedValueOnce(new Error('Rollback failed'));

      const migration: DiscoveredMigration = {
        id: '01_broken.sql',
        name: '01_broken.sql',
        prefix: 1,
        filePath: '/path/01_broken.sql',
        content: 'INVALID;',
        checksum: 'hash-broken',
        containsDDL: false,
      };

      await expect(
        runCustomMigrations({
          migrations: [migration],
          engine: 'mysql',
          connectionUrl: 'mysql://user:pass@localhost:3306/testdb',
        }),
      ).rejects.toThrow('Migration "01_broken.sql" failed: MySQL query error');
    });
  });
});
