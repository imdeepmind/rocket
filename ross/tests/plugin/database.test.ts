import Fastify from 'fastify';
import {describe, expect, test, vi} from 'vitest';

import databasePlugin from '@/plugin/database';

import {DatabaseConfig, ResolvedAppConfig} from '@/interfaces/config';

import {pgConfig, sqliteConfig} from '@tests/helpers/test-app';

import {
  pgClientQueryMock,
  pgClientReleaseMock,
  pgEndMock,
  pgQueryMock,
  sqliteAllMock,
  sqliteCloseMock,
  sqliteExecMock,
  sqlitePrepareMock,
  sqliteRunMock,
} from '../helpers/db-mocks';

describe('database plugin', () => {
  function buildApp(dbConfig: DatabaseConfig) {
    const fastify = Fastify();
    fastify.appConfig = {
      application: {name: 'Test', logLevel: 'error'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {database: dbConfig},
      data: {models: {}},
    } as ResolvedAppConfig;
    return fastify;
  }

  test('throws error for unsupported engine', async () => {
    const fastify = buildApp({
      engine: 'mysql' as DatabaseConfig['engine'],
      connection: {url: 'mysql://localhost'},
    });

    await expect(fastify.register(databasePlugin)).rejects.toThrow(
      'Unsupported database engine: mysql',
    );
  });

  describe('postgres engine', () => {
    test('decorates fastify with db', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      expect(fastify.hasDecorator('db')).toBe(true);
      await fastify.close();
    });

    test('query method returns structured response', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const mockRows = [{id: 1, name: 'Test'}];
      pgQueryMock.mockResolvedValueOnce({rows: mockRows, rowCount: 1});

      const result = await fastify.db.query('SELECT * FROM test');
      expect(result).toEqual({
        changes: 0,
        rows: mockRows,
      });
      expect(pgQueryMock).toHaveBeenCalledWith('SELECT * FROM test', []);
      await fastify.close();
    });

    test('query method returns changes for non-SELECT', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 5});

      const result = await fastify.db.query(
        'INSERT INTO test (name) VALUES ($1)',
        ['New Name'],
      );
      expect(result).toEqual({
        changes: 5,
        rows: [],
      });
      expect(pgQueryMock).toHaveBeenCalledWith(
        'INSERT INTO test (name) VALUES ($1)',
        ['New Name'],
      );
      await fastify.close();
    });

    test('query handles missing rowCount in PG', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: null});

      const result = await fastify.db.query('UPDATE test SET name = $1', [
        'Name',
      ]);
      expect(result.changes).toBe(0);
      await fastify.close();
    });

    test('close method calls pool.end', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      await fastify.db.close();
      expect(pgEndMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('onClose hook calls db.close', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const closeSpy = vi.spyOn(fastify.db, 'close');
      await fastify.close();
      expect(closeSpy).toHaveBeenCalled();
    });

    test('query timeout is passed to postgres pool', async () => {
      const fastify = buildApp({...pgConfig, timeout: 5000});
      await fastify.register(databasePlugin);
      await fastify.ready();

      const {Pool} = await import('pg');
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          statement_timeout: 5000,
          query_timeout: 5000,
        }),
      );
      await fastify.close();
    });

    test('query method blocks DDL queries', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const ddlQueries = [
        'CREATE TABLE users (id SERIAL PRIMARY KEY)',
        'ALTER TABLE users ADD COLUMN name TEXT',
        'DROP TABLE users',
        'TRUNCATE users',
        'RENAME TABLE users TO customers',
        'GRANT ALL ON users TO guest',
        'REVOKE ALL ON users FROM guest',
      ];

      for (const query of ddlQueries) {
        await expect(fastify.db.query(query)).rejects.toThrow(
          'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
        );
      }

      await fastify.close();
    });

    test('beginTransaction commits on success', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const tx = await fastify.db.beginTransaction();
      const result = await tx.query('INSERT INTO test (name) VALUES ($1)', [
        'test',
      ]);
      await tx.commit();
      tx.release();

      expect(result).toEqual({changes: 0, rows: []});
      expect(pgClientQueryMock).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(pgClientQueryMock).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO test (name) VALUES ($1)',
        ['test'],
      );
      expect(pgClientQueryMock).toHaveBeenNthCalledWith(3, 'COMMIT');
      expect(pgClientReleaseMock).toHaveBeenCalled();

      await fastify.close();
    });

    test('beginTransaction handles missing rowCount in non-SELECT query', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: null}) // INSERT with null rowCount
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const tx = await fastify.db.beginTransaction();
      const result = await tx.query('INSERT INTO test (name) VALUES ($1)', [
        'test',
      ]);
      await tx.commit();
      tx.release();

      expect(result).toEqual({changes: 0, rows: []});

      await fastify.close();
    });

    test('beginTransaction rolls back on error', async () => {
      const fastify = buildApp(pgConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      pgClientQueryMock.mockClear();

      const tx = await fastify.db.beginTransaction();
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // SELECT
        .mockRejectedValueOnce(new Error('insert failed')); // INSERT
      try {
        await tx.query('SELECT 1');
        await tx.query('INSERT INTO fail VALUES (1)');
        await tx.commit();
      } catch {
        await tx.rollback();
      }
      tx.release();

      expect(pgClientQueryMock).toHaveBeenCalledWith('ROLLBACK');
      expect(pgClientQueryMock).not.toHaveBeenCalledWith('COMMIT');

      await fastify.close();
    });
  });

  describe('sqlite engine', () => {
    test('decorates fastify with db', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      expect(fastify.hasDecorator('db')).toBe(true);
      await fastify.close();
    });

    test('query method calls prepare and all for SELECT', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const mockRows = [{id: 2, title: 'SQLite'}];
      sqliteAllMock.mockReturnValueOnce(mockRows);

      const result = await fastify.db.query('SELECT * FROM posts');
      expect(result).toEqual({
        changes: 0,
        rows: mockRows,
      });
      expect(sqlitePrepareMock).toHaveBeenCalledWith('SELECT * FROM posts');
      expect(sqliteAllMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('query method normalizes parameters (boolean, undefined, Date)', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const now = new Date();
      await fastify.db.query('INSERT INTO test VALUES ($1, $2, $3, $4)', [
        true,
        false,
        undefined,
        now,
      ]);

      expect(sqliteRunMock).toHaveBeenCalledWith([
        1,
        0,
        null,
        now.toISOString(),
      ]);
      await fastify.close();
    });

    test('query handles missing changes in SQLite', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteRunMock.mockReturnValueOnce({changes: undefined});

      const result = await fastify.db.query('DELETE FROM posts');
      expect(result.changes).toBe(0);
      await fastify.close();
    });

    test('query method calls prepare and run for INSERT/UPDATE', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteRunMock.mockReturnValueOnce({changes: 1});

      const result = await fastify.db.query(
        'INSERT INTO posts (title) VALUES (?)',
        ['New Post'],
      );
      expect(result).toEqual({
        changes: 1,
        rows: [],
      });
      expect(sqlitePrepareMock).toHaveBeenCalledWith(
        'INSERT INTO posts (title) VALUES (?)',
      );
      expect(sqliteRunMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('close method calls sqlite.close', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      await fastify.db.close();
      expect(sqliteCloseMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('query timeout is passed to sqlite constructor', async () => {
      const fastify = buildApp({...sqliteConfig, timeout: 3000});
      await fastify.register(databasePlugin);
      await fastify.ready();

      const Database = (await import('better-sqlite3')).default;
      expect(Database).toHaveBeenCalledWith(
        sqliteConfig.connection.url,
        expect.objectContaining({
          timeout: 3000,
        }),
      );
      await fastify.close();
    });

    test('query method blocks DDL queries', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const ddlQueries = [
        'CREATE TABLE users (id INTEGER PRIMARY KEY)',
        'ALTER TABLE users ADD COLUMN name TEXT',
        'DROP TABLE users',
        'TRUNCATE users',
        'RENAME TABLE users TO customers',
        'GRANT ALL ON users TO guest',
        'REVOKE ALL ON users FROM guest',
      ];

      for (const query of ddlQueries) {
        await expect(fastify.db.query(query)).rejects.toThrow(
          'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
        );
      }

      await fastify.close();
    });

    test('query method handles errors in SQLite', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const mockError = new Error('Database Error');
      sqliteAllMock.mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(fastify.db.query('SELECT * FROM invalid')).rejects.toThrow(
        'Database Error',
      );
      await fastify.close();
    });

    test('beginTransaction commits on success', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      const tx = await fastify.db.beginTransaction();
      const result = await tx.query('INSERT INTO test (name) VALUES (?)', [
        'test',
      ]);
      await tx.commit();
      tx.release();

      expect(result).toEqual({changes: 0, rows: []});
      expect(sqliteExecMock).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(sqlitePrepareMock).toHaveBeenCalledWith(
        'INSERT INTO test (name) VALUES (?)',
      );
      expect(sqliteExecMock).toHaveBeenNthCalledWith(2, 'COMMIT');

      await fastify.close();
    });

    test('beginTransaction handles missing changes in non-SELECT query', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteRunMock.mockReturnValueOnce({changes: undefined});

      const tx = await fastify.db.beginTransaction();
      const result = await tx.query('INSERT INTO test (name) VALUES (?)', [
        'test',
      ]);
      await tx.commit();
      tx.release();

      expect(result).toEqual({changes: 0, rows: []});

      await fastify.close();
    });

    test('beginTransaction rolls back on error', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock.mockClear();

      const tx = await fastify.db.beginTransaction();
      sqliteAllMock.mockImplementationOnce(() => {
        throw new Error('query failed');
      });
      try {
        await tx.query('SELECT * FROM fail');
        await tx.commit();
      } catch {
        await tx.rollback();
      }
      tx.release();

      expect(sqliteExecMock).toHaveBeenCalledWith('ROLLBACK');
      expect(sqliteExecMock).not.toHaveBeenCalledWith('COMMIT');

      await fastify.close();
    });

    test('serializes concurrent SQLite transactions in FIFO order', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock.mockClear();

      let tx2Resolved = false;

      const tx1 = await fastify.db.beginTransaction();
      expect(sqliteExecMock).toHaveBeenCalledWith('BEGIN');
      expect(sqliteExecMock).toHaveBeenCalledTimes(1);

      // Start tx2 while tx1 is still in flight
      const tx2Promise = fastify.db.beginTransaction().then(tx => {
        tx2Resolved = true;
        return tx;
      });

      // Allow microtasks to run and verify tx2 has not yet acquired or called BEGIN
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(tx2Resolved).toBe(false);
      expect(sqliteExecMock).toHaveBeenCalledTimes(1);

      // Finish tx1
      await tx1.commit();
      tx1.release();

      expect(sqliteExecMock).toHaveBeenNthCalledWith(2, 'COMMIT');

      // Now tx2 should resolve
      const tx2 = await tx2Promise;
      expect(tx2Resolved).toBe(true);
      expect(sqliteExecMock).toHaveBeenNthCalledWith(3, 'BEGIN');

      await tx2.commit();
      tx2.release();

      expect(sqliteExecMock).toHaveBeenNthCalledWith(4, 'COMMIT');

      await fastify.close();
    });

    test('release() automatically rolls back if transaction was uncommitted', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock.mockClear();

      const tx = await fastify.db.beginTransaction();
      expect(sqliteExecMock).toHaveBeenCalledWith('BEGIN');

      // Release without commit or rollback
      tx.release();
      expect(sqliteExecMock).toHaveBeenCalledWith('ROLLBACK');

      // Verify next transaction can proceed immediately
      const nextTx = await fastify.db.beginTransaction();
      await nextTx.commit();
      nextTx.release();

      expect(sqliteExecMock).toHaveBeenLastCalledWith('COMMIT');

      await fastify.close();
    });

    test('commit, rollback, and release are idempotent on SQLite transaction', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock.mockClear();

      const tx = await fastify.db.beginTransaction();
      await tx.commit();
      await tx.commit(); // second commit is a no-op
      await tx.rollback(); // rollback after commit is a no-op
      tx.release(); // release after commit is a no-op

      expect(sqliteExecMock.mock.calls.map(c => c[0])).toEqual([
        'BEGIN',
        'COMMIT',
      ]);

      await fastify.close();
    });

    test('handles BEGIN error and releases lock for subsequent transactions', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock.mockImplementationOnce(() => {
        throw new Error('BEGIN failed');
      });

      await expect(fastify.db.beginTransaction()).rejects.toThrow(
        'BEGIN failed',
      );

      // Next transaction should acquire and succeed without deadlock
      const tx = await fastify.db.beginTransaction();
      await tx.commit();
      tx.release();

      await fastify.close();
    });

    test('handles commit failure and releases lock', async () => {
      const fastify = buildApp(sqliteConfig);
      await fastify.register(databasePlugin);
      await fastify.ready();

      sqliteExecMock
        .mockImplementationOnce(() => {}) // BEGIN
        .mockImplementationOnce(() => {
          throw new Error('COMMIT failed');
        });

      const tx = await fastify.db.beginTransaction();
      await expect(tx.commit()).rejects.toThrow('COMMIT failed');

      // Lock should have been released in finally
      const tx2 = await fastify.db.beginTransaction();
      await tx2.commit();
      tx2.release();

      await fastify.close();
    });
  });
});
