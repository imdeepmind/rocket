import Fastify from 'fastify';
import {describe, expect, test, vi} from 'vitest';

import databasePlugin from '@/plugin/database';

import {DatabaseConfig} from '@/schema/config';

import {pgConfig, sqliteConfig} from '@tests/helpers/test-app';

import {
  pgEndMock,
  pgQueryMock,
  sqliteAllMock,
  sqliteCloseMock,
  sqlitePrepareMock,
  sqliteRunMock,
} from '../helpers/db-mocks';

describe('database plugin', () => {
  test('throws error for unsupported engine', async () => {
    const fastify = Fastify();
    const invalidConfig = {
      engine: 'mysql',
      connection: {urlOrPath: 'mysql://localhost'},
    } as unknown as DatabaseConfig;

    await expect(
      fastify.register(databasePlugin, invalidConfig),
    ).rejects.toThrow('Unsupported database engine: mysql');
  });

  describe('pg engine', () => {
    test('decorates fastify with db', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
      await fastify.ready();

      expect(fastify.hasDecorator('db')).toBe(true);
      await fastify.close();
    });

    test('query method returns structured response', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
      await fastify.ready();

      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: null});

      const result = await fastify.db.query('UPDATE test SET name = $1', [
        'Name',
      ]);
      expect(result.changes).toBe(0);
      await fastify.close();
    });

    test('close method calls pool.end', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
      await fastify.ready();

      await fastify.db.close();
      expect(pgEndMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('onClose hook calls db.close', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
      await fastify.ready();

      const closeSpy = vi.spyOn(fastify.db, 'close');
      await fastify.close();
      expect(closeSpy).toHaveBeenCalled();
    });

    test('query timeout is passed to postgres pool', async () => {
      const fastify = Fastify();
      const customConfig = {
        ...pgConfig,
        dbTimeout: 5000,
      };
      await fastify.register(databasePlugin, customConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, pgConfig);
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
  });

  describe('sqlite engine', () => {
    test('decorates fastify with db', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
      await fastify.ready();

      expect(fastify.hasDecorator('db')).toBe(true);
      await fastify.close();
    });

    test('query method calls prepare and all for SELECT', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
      await fastify.ready();

      sqliteRunMock.mockReturnValueOnce({changes: undefined});

      const result = await fastify.db.query('DELETE FROM posts');
      expect(result.changes).toBe(0);
      await fastify.close();
    });

    test('query method calls prepare and run for INSERT/UPDATE', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
      await fastify.ready();

      await fastify.db.close();
      expect(sqliteCloseMock).toHaveBeenCalled();
      await fastify.close();
    });

    test('query timeout is passed to sqlite constructor', async () => {
      const fastify = Fastify();
      const customConfig = {
        ...sqliteConfig,
        dbTimeout: 3000,
      };
      await fastify.register(databasePlugin, customConfig);
      await fastify.ready();

      const Database = (await import('better-sqlite3')).default;
      expect(Database).toHaveBeenCalledWith(
        sqliteConfig.connection.urlOrPath,
        expect.objectContaining({
          timeout: 3000,
        }),
      );
      await fastify.close();
    });

    test('query method blocks DDL queries', async () => {
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
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
      const fastify = Fastify();
      await fastify.register(databasePlugin, sqliteConfig);
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
  });
});
