import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test} from 'vitest';

import cachePlugin from '@/plugin/cache';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {resolveConfig} from '@/lib/config/resolve';
import {
  registerErrorHandler,
  registerNotFoundHandler,
} from '@/lib/server/error-handler';

import {registerHealthRoute} from '@/routes/health';

import {ModelConfig} from '@/interfaces/config';

import {
  mysqlConnBeginTxMock,
  mysqlConnCommitMock,
  mysqlConnQueryMock,
  mysqlConnReleaseMock,
  mysqlConnRollbackMock,
  mysqlQueryMock,
} from '@tests/helpers/db-mocks';
import {createTestApp, mysqlConfig} from '@tests/helpers/test-app';

const testModels: Record<string, ModelConfig> = {
  users: {
    timestamps: true,
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        autoIncrement: true,
        apis: ['index', 'edit', 'delete'],
        aggregations: ['count', 'max'],
      },
      name: {
        type: 'string',
        apis: ['search', 'edit'],
      },
      email: {
        type: 'string',
        unique: true,
        apis: ['edit'],
      },
      role: {
        type: 'string',
        default: 'user',
      },
    },
    indexes: {
      email_idx: {fields: ['email'], unique: true},
    },
  },
};

async function createMysqlHealthApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.appConfig = resolveConfig(
    {
      application: {name: 'MySQL Health App', logLevel: 'error'},
      infrastructure: {database: mysqlConfig},
    },
    {mode: 'dev'},
  );
  registerErrorHandler(app);
  registerNotFoundHandler(app);
  await app.register(databasePlugin);
  await app.register(cachePlugin);
  await app.register(responsePlugin);
  registerHealthRoute(app, app.appConfig);
  await app.ready();
  return app;
}

describe('MySQL route operations', () => {
  beforeEach(() => {
    mysqlQueryMock.mockClear();
    mysqlConnQueryMock.mockClear();
    mysqlConnBeginTxMock.mockClear();
    mysqlConnCommitMock.mockClear();
    mysqlConnRollbackMock.mockClear();
    mysqlConnReleaseMock.mockClear();
  });

  describe('CRUD operations', () => {
    test('POST should insert record and return 201', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      mysqlConnQueryMock.mockResolvedValueOnce([{affectedRows: 1}, []]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        code: 201,
        message: 'Successfully added the new entry to the users table',
        data: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      });

      expect(mysqlConnQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES (?, ?);',
        ['Alice', 'alice@example.com'],
      );
      expect(mysqlConnCommitMock).toHaveBeenCalled();
      expect(mysqlConnReleaseMock).toHaveBeenCalled();

      await app.close();
    });

    test('POST should return 409 on duplicate key error', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      mysqlConnQueryMock.mockRejectedValueOnce(
        Object.assign(
          new Error(
            "Duplicate entry 'alice@example.com' for key 'users.email'",
          ),
          {code: 'ER_DUP_ENTRY'},
        ),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: 409,
        message: 'Email already exists',
      });
      expect(mysqlConnRollbackMock).toHaveBeenCalled();

      await app.close();
    });

    test('GET all records should return 200 with list and total', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      const mockRows = [
        {id: 1, name: 'Alice', email: 'alice@example.com', role: 'user'},
      ];
      // 1st query: count, 2nd query: rows
      mysqlConnQueryMock
        .mockResolvedValueOnce([[{total: 1}], []])
        .mockResolvedValueOnce([mockRows, []]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual(mockRows);
      expect(response.json().data.pagination.total).toBe(1);

      await app.close();
    });

    test('GET by index should return record', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      const mockRows = [
        {id: 1, name: 'Alice', email: 'alice@example.com', role: 'user'},
      ];
      // id is primaryKey/unique, so only 1 query is executed
      mysqlConnQueryMock.mockResolvedValueOnce([mockRows, []]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        data: mockRows[0],
      });

      await app.close();
    });

    test('PATCH should update record', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      mysqlConnQueryMock.mockResolvedValueOnce([{affectedRows: 1}, []]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/id/1',
        payload: {
          name: 'Alice Updated',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        code: 200,
        message: 'Successfully updated records in the users table',
      });

      await app.close();
    });

    test('DELETE should remove record', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      mysqlConnQueryMock.mockResolvedValueOnce([{affectedRows: 1}, []]);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(204);

      await app.close();
    });
  });

  describe('Search & Aggregate operations', () => {
    test('Search endpoint queries records using MySQL syntax', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      const mockRows = [
        {id: 1, name: 'Alice', email: 'alice@example.com', role: 'user'},
      ];
      mysqlConnQueryMock
        .mockResolvedValueOnce([[{total: 1}], []])
        .mockResolvedValueOnce([mockRows, []]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=ali',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual(mockRows);

      await app.close();
    });

    test('Aggregate endpoint executes aggregations on MySQL', async () => {
      const app = await createTestApp(mysqlConfig, testModels);

      mysqlConnQueryMock.mockResolvedValueOnce([[{count: 5, max: 10}], []]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/aggregation/id?operations=count,max',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        code: 200,
        data: {
          count: 5,
          max: 10,
        },
      });

      await app.close();
    });
  });

  describe('Health check', () => {
    test('health check validates MySQL connection when up', async () => {
      const app = await createMysqlHealthApp();

      mysqlQueryMock.mockResolvedValueOnce([[{1: 1}], []]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().services.database.status).toBe('up');

      await app.close();
    });

    test('health check reports down when MySQL query fails', async () => {
      const app = await createMysqlHealthApp();

      mysqlQueryMock.mockRejectedValueOnce(new Error('Connection lost'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().services.database.status).toBe('down');
      expect(response.json().services.database.error).toBe(
        'Database service is unavailable',
      );

      await app.close();
    });
  });
});
