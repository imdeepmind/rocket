import {beforeEach, describe, expect, test} from 'vitest';

import {AuthConfig, ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, mockModels, pgConfig} from '@tests/helpers/test-app';

const upAuthConfig: AuthConfig = {
  enableAuth: true,
  authEngine: 'up-auth',
  authModel: {
    modelName: 'users',
    idColumn: 'id',
    usernameColumn: 'email',
    passwordColumn: 'password',
  },
};

describe('test post api', () => {
  beforeEach(() => {
    // Clear mock state between tests so call assertions are isolated
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should create a new record and return 201 with the body', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      const response = await fastify.inject({
        method: 'POST',
        url: '/users/',
        payload: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        code: 201,
        message: 'Successfully added the new entry to the users table',
        data: {
          name: 'Test User',
          email: 'test@example.com',
        },
        raw_data: {
          rows: [],
          changes: 0,
        },
      });

      await fastify.close();
    });

    test('should build the correct INSERT SQL query with columns and placeholders', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      await fastify.inject({
        method: 'POST',
        url: '/users/',
        payload: {name: 'Alice', email: 'alice@example.com'},
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2);',
        ['Alice', 'alice@example.com'],
      );

      await fastify.close();
    });

    test('should strip extra fields not defined in the model', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      await fastify.inject({
        method: 'POST',
        url: '/users/',
        payload: {
          name: 'Bob',
          email: 'bob@example.com',
          // Extra fields that should be removed
          createdAt: '2024-01-01',
          role: 'admin',
        },
      });

      // Only model-defined fields should appear in the query
      expect(pgQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2);',
        ['Bob', 'bob@example.com'],
      );

      await fastify.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when required fields are missing', async () => {
      const modelsWithRequired: ModelConfig[] = [
        {
          name: 'products',
          fields: [
            {name: 'id', type: 'integer', primaryKey: true},
            {name: 'title', type: 'string'},
          ],
          // Provide an explicit validation schema that marks fields as required
          validation: {
            type: 'object',
            properties: {
              id: {type: 'integer'},
              title: {type: 'string'},
            },
            required: ['id', 'title'],
          },
        },
      ];

      const fastify = await createTestApp(pgConfig, modelsWithRequired);

      const response = await fastify.inject({
        method: 'POST',
        url: '/products/',
        payload: {id: 1}, // missing 'title'
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 400 when body is invalid JSON type', async () => {
      const modelsWithRequired: ModelConfig[] = [
        {
          name: 'items',
          fields: [{name: 'count', type: 'integer'}],
          validation: {
            type: 'object',
            properties: {
              count: {type: 'integer'},
            },
            required: ['count'],
          },
        },
      ];

      const fastify = await createTestApp(pgConfig, modelsWithRequired);

      const response = await fastify.inject({
        method: 'POST',
        url: '/items/',
        payload: {count: 'not-a-number'}, // should be integer
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);
      pgQueryMock.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await fastify.inject({
        method: 'POST',
        url: '/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 for a route that does not match any model', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      const response = await fastify.inject({
        method: 'POST',
        url: '/nonexistent/',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe('authentication', () => {
    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        undefined,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 201 when auth is enabled and valid token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        undefined,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'POST',
        url: '/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(201);
      await fastify.close();
    });
  });
});
