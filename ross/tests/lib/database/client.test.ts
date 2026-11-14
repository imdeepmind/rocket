import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createDatabaseClient} from '@/lib/database/client';
import {
  isDdlQuery,
  isDmlQuery,
  isSelectQuery,
  normalizeSqliteParams,
  normalizeSqliteValue,
  splitSqlStatements,
  stripComments,
} from '@/lib/database/query';

import {
  mysqlConnBeginTxMock,
  mysqlConnCommitMock,
  mysqlConnQueryMock,
  mysqlConnReleaseMock,
  mysqlConnRollbackMock,
  mysqlEndMock,
  mysqlGetConnectionMock,
  mysqlOnMock,
  mysqlQueryMock,
  pgClientQueryMock,
  pgClientReleaseMock,
  pgEndMock,
  pgQueryMock,
  sqliteAllMock,
  sqliteCloseMock,
  sqliteExecMock,
  sqliteRunMock,
} from '@tests/helpers/db-mocks';

describe('lib/database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query helpers', () => {
    it('splits SQL statements correctly respecting quotes and comments', () => {
      const sql = `
        -- First statement
        SELECT '; not end', "also; not end";
        /* Block comment with ; */
        INSERT INTO users (val) VALUES ('-- not comment');
      `;
      const stmts = splitSqlStatements(sql);
      expect(stmts).toHaveLength(2);
      expect(stmts[0]).toContain("SELECT '; not end'");
      expect(stmts[1]).toContain('INSERT INTO users');
    });

    it('handles trailing statements without semicolons and empty strings', () => {
      expect(splitSqlStatements('')).toEqual([]);
      expect(splitSqlStatements('   ')).toEqual([]);
      expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
    });

    it('strips block and line comments while preserving quotes', () => {
      const sql =
        'SELECT * /* block */ FROM users WHERE a = \'-- not comment\' AND b = "/* not comment */"; -- line comment';
      const stripped = stripComments(sql);
      expect(stripped).toContain("WHERE a = '-- not comment'");
      expect(stripped).toContain('AND b = "/* not comment */"');
      expect(stripped).not.toContain('/* block */');
      expect(stripped).not.toContain('-- line comment');
    });

    it('identifies select, dml, and ddl queries correctly', () => {
      expect(isSelectQuery('SELECT * FROM t')).toBe(true);
      expect(isSelectQuery('WITH cte AS (...) SELECT * FROM cte')).toBe(true);
      expect(isSelectQuery('INSERT INTO t VALUES (1)')).toBe(false);

      expect(isDmlQuery('SELECT 1')).toBe(true);
      expect(isDmlQuery('INSERT INTO t VALUES (1)')).toBe(true);
      expect(isDmlQuery('UPDATE t SET a = 1')).toBe(true);
      expect(isDmlQuery('DELETE FROM t')).toBe(true);
      expect(isDmlQuery('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true);
      expect(isDmlQuery('')).toBe(true);
      expect(isDmlQuery('CREATE TABLE t (id INT)')).toBe(false);

      expect(isDdlQuery('CREATE TABLE t (id INT)')).toBe(true);
      expect(isDdlQuery('ALTER TABLE t ADD COLUMN name TEXT')).toBe(true);
      expect(isDdlQuery('DROP TABLE t')).toBe(true);
      expect(isDdlQuery('TRUNCATE t')).toBe(true);
      expect(isDdlQuery('SELECT 1')).toBe(false);
      expect(isDdlQuery('')).toBe(false);
    });

    it('normalizes sqlite params and values', () => {
      expect(normalizeSqliteParams('SELECT $1, $2, $10')).toBe(
        'SELECT ?, ?, ?',
      );
      expect(normalizeSqliteValue(true)).toBe(1);
      expect(normalizeSqliteValue(false)).toBe(0);
      expect(normalizeSqliteValue(undefined)).toBeNull();
      const date = new Date('2026-01-01T00:00:00.000Z');
      expect(normalizeSqliteValue(date)).toBe('2026-01-01T00:00:00.000Z');
      expect(normalizeSqliteValue(123)).toBe(123);
      expect(normalizeSqliteValue('string')).toBe('string');
    });
  });

  describe('createDatabaseClient', () => {
    it('throws error for unsupported engine', () => {
      expect(() =>
        createDatabaseClient({
          engine: 'oracle' as never,
          url: 'oracle://localhost',
        }),
      ).toThrow('Unsupported database engine: oracle');
    });

    describe('postgres client', () => {
      it('executes select query on pool', async () => {
        pgQueryMock.mockResolvedValueOnce({rows: [{id: 1}], rowCount: 1});
        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
        });

        const res = await client.query('SELECT * FROM users');
        expect(res).toEqual({changes: 0, rows: [{id: 1}]});
        await client.close();
        expect(pgEndMock).toHaveBeenCalledTimes(1);
      });

      it('executes dml query returning rowCount as changes', async () => {
        pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 3});
        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
        });

        const res = await client.query('UPDATE users SET active = true');
        expect(res).toEqual({changes: 3, rows: []});
      });

      it('blocks DDL query when allowDdl is false', async () => {
        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
          allowDdl: false,
        });

        await expect(client.query('CREATE TABLE t (id INT)')).rejects.toThrow(
          'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
        );
      });

      it('permits DDL query when allowDdl is true', async () => {
        pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});
        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
          allowDdl: true,
        });

        const res = await client.query('CREATE TABLE t (id INT)');
        expect(res).toEqual({changes: 0, rows: []});
      });

      it('manages transaction commit, rollback, and release', async () => {
        pgClientQueryMock.mockResolvedValueOnce({rows: []}); // BEGIN
        pgClientQueryMock.mockResolvedValueOnce({rows: [{id: 1}], rowCount: 1}); // SELECT
        pgClientQueryMock.mockResolvedValueOnce({rows: []}); // COMMIT

        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
        });

        const tx = await client.beginTransaction();
        const res = await tx.query('SELECT 1');
        expect(res.rows).toEqual([{id: 1}]);
        await tx.commit();
        tx.release();

        expect(pgClientQueryMock).toHaveBeenCalledWith('BEGIN');
        expect(pgClientQueryMock).toHaveBeenCalledWith('COMMIT');
        expect(pgClientReleaseMock).toHaveBeenCalledTimes(1);
      });

      it('executes rollback on transaction', async () => {
        pgClientQueryMock.mockResolvedValueOnce({rows: []}); // BEGIN
        pgClientQueryMock.mockResolvedValueOnce({rows: []}); // ROLLBACK

        const client = createDatabaseClient({
          engine: 'postgres',
          url: 'postgres://localhost/test',
        });

        const tx = await client.beginTransaction();
        await tx.rollback();
        expect(pgClientQueryMock).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('sqlite client', () => {
      it('executes select query', async () => {
        sqliteAllMock.mockReturnValueOnce([{id: 1}]);
        const client = createDatabaseClient({
          engine: 'sqlite',
          url: ':memory:',
        });

        const res = await client.query('SELECT * FROM users');
        expect(res).toEqual({changes: 0, rows: [{id: 1}]});
        await client.close();
        expect(sqliteCloseMock).toHaveBeenCalledTimes(1);
      });

      it('executes dml run query', async () => {
        sqliteRunMock.mockReturnValueOnce({changes: 2});
        const client = createDatabaseClient({
          engine: 'sqlite',
          url: ':memory:',
        });

        const res = await client.query('UPDATE users SET active = ?', [1]);
        expect(res).toEqual({changes: 2, rows: []});
      });

      it('executes multi-statement sql via exec when multipleStatements is true and no params', async () => {
        const client = createDatabaseClient({
          engine: 'sqlite',
          url: ':memory:',
          allowDdl: true,
          multipleStatements: true,
        });

        const res = await client.query(
          'CREATE TABLE t1 (id INT); CREATE TABLE t2 (id INT);',
        );
        expect(res).toEqual({changes: 0, rows: []});
        expect(sqliteExecMock).toHaveBeenCalledWith(
          'CREATE TABLE t1 (id INT); CREATE TABLE t2 (id INT);',
        );
      });

      it('manages sqlite transaction commit, rollback, and auto-rollback on release', async () => {
        const client = createDatabaseClient({
          engine: 'sqlite',
          url: ':memory:',
        });

        const tx = await client.beginTransaction();
        expect(sqliteExecMock).toHaveBeenCalledWith('BEGIN');
        await tx.commit();
        expect(sqliteExecMock).toHaveBeenCalledWith('COMMIT');

        // Second tx to test rollback
        const tx2 = await client.beginTransaction();
        await tx2.rollback();
        expect(sqliteExecMock).toHaveBeenCalledWith('ROLLBACK');

        // Third tx to test auto rollback on uncommitted release
        const tx3 = await client.beginTransaction();
        tx3.release();
        expect(sqliteExecMock).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('mysql client', () => {
      it('configures connection pool and ANSI_QUOTES', async () => {
        let connectionCallback: ((conn: unknown) => void) | undefined;
        mysqlOnMock.mockImplementation(
          (event: string, cb: (conn: unknown) => void) => {
            if (event === 'connection') {
              connectionCallback = cb;
            }
          },
        );

        const client = createDatabaseClient({
          engine: 'mysql',
          url: 'mysql://localhost/test',
          multipleStatements: true,
        });

        const fakeConn = {query: vi.fn()};
        connectionCallback?.(fakeConn);
        expect(fakeConn.query).toHaveBeenCalledWith(
          expect.stringContaining('ANSI_QUOTES'),
          expect.any(Function),
        );

        await client.close();
        expect(mysqlEndMock).toHaveBeenCalledTimes(1);
      });

      it('executes select and dml queries on pool', async () => {
        mysqlQueryMock.mockResolvedValueOnce([[{id: 1}], []]);
        mysqlQueryMock.mockResolvedValueOnce([{affectedRows: 5}, []]);

        const client = createDatabaseClient({
          engine: 'mysql',
          url: 'mysql://localhost/test',
        });

        const selectRes = await client.query('SELECT * FROM users');
        expect(selectRes).toEqual({changes: 0, rows: [{id: 1}]});

        const dmlRes = await client.query('UPDATE users SET active = 1');
        expect(dmlRes).toEqual({changes: 5, rows: []});
      });

      it('manages mysql transaction commit, rollback, and release', async () => {
        mysqlConnQueryMock.mockResolvedValueOnce([[{val: 1}], []]);

        const client = createDatabaseClient({
          engine: 'mysql',
          url: 'mysql://localhost/test',
        });

        const tx = await client.beginTransaction();
        expect(mysqlGetConnectionMock).toHaveBeenCalledTimes(1);
        expect(mysqlConnBeginTxMock).toHaveBeenCalledTimes(1);

        const res = await tx.query('SELECT 1');
        expect(res.rows).toEqual([{val: 1}]);

        await tx.commit();
        expect(mysqlConnCommitMock).toHaveBeenCalledTimes(1);

        tx.release();
        expect(mysqlConnReleaseMock).toHaveBeenCalledTimes(1);
      });

      it('rolls back uncommitted transaction on release', async () => {
        const client = createDatabaseClient({
          engine: 'mysql',
          url: 'mysql://localhost/test',
        });

        const tx = await client.beginTransaction();
        tx.release();
        expect(mysqlConnRollbackMock).toHaveBeenCalledTimes(1);
        expect(mysqlConnReleaseMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
