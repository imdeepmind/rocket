import {beforeEach, describe, expect, test} from 'vitest';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {
  pgClientQueryMock,
  pgConnectMock,
  pgQueryMock,
} from '@tests/helpers/db-mocks';
import {createTestApp, mockModels, pgConfig} from '@tests/helpers/test-app';

const upAuthConfig: AuthenticationConfig = {
  enabled: true,
  provider: {
    type: 'up-auth',
    config: {
      userModel: {
        model: 'users',
        idField: 'id',
        usernameField: 'email',
        passwordField: 'password',
      },
    },
  },
};

describe('test post api', () => {
  beforeEach(() => {
    // Clear mock state between tests so call assertions are isolated
    pgQueryMock.mockClear();
    pgClientQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should create a new record and return 201 with the body', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
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
        url: '/v1/users/',
        payload: {name: 'Alice', email: 'alice@example.com'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2);',
        ['Alice', 'alice@example.com'],
      );

      await fastify.close();
    });

    test('should strip extra fields not defined in the model', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);

      await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {
          name: 'Bob',
          email: 'bob@example.com',
          // Extra fields that should be removed
          createdAt: '2024-01-01',
          role: 'admin',
        },
      });

      // Only model-defined fields should appear in the query
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2);',
        ['Bob', 'bob@example.com'],
      );

      await fastify.close();
    });
  });

  describe('secret fields', () => {
    const secretModel: Record<string, ModelConfig> = {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true, autoIncrement: true},
          name: {type: 'string'},
          email: {type: 'string'},
          api_key: {type: 'string', secret: true},
        },
      },
    };

    test('should write secret fields to the database but exclude them from the response', async () => {
      const fastify = await createTestApp(pgConfig, secretModel);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {
          name: 'Carol',
          email: 'carol@example.com',
          api_key: 'sk-123',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toEqual({
        name: 'Carol',
        email: 'carol@example.com',
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email", "api_key") VALUES ($1, $2, $3);',
        ['Carol', 'carol@example.com', 'sk-123'],
      );

      await fastify.close();
    });
  });

  describe('managed timestamps', () => {
    const timestampModel: Record<string, ModelConfig> = {
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          title: {type: 'string'},
          created_at: {type: 'datetime', nullable: false},
          updated_at: {type: 'datetime', nullable: false},
        },
      },
    };

    test('should not require managed timestamp fields on create', async () => {
      const fastify = await createTestApp(pgConfig, timestampModel);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/posts/',
        payload: {title: 'Hello'},
      });

      expect(response.statusCode).toBe(201);

      await fastify.close();
    });

    test('should strip user-supplied created_at and updated_at from the INSERT', async () => {
      const fastify = await createTestApp(pgConfig, timestampModel);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/posts/',
        payload: {
          title: 'Hello',
          created_at: '2020-01-01T00:00:00.000Z',
          updated_at: '2020-01-01T00:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'INSERT INTO "posts" ("title") VALUES ($1);',
        ['Hello'],
      );

      await fastify.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when required fields are missing', async () => {
      const modelsWithRequired: Record<string, ModelConfig> = {
        products: {
          fields: {
            id: {type: 'integer', primaryKey: true},
            title: {type: 'string'},
          },
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
      };

      const fastify = await createTestApp(pgConfig, modelsWithRequired);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/products/',
        payload: {id: 1}, // missing 'title'
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 400 when body is invalid JSON type', async () => {
      const modelsWithRequired: Record<string, ModelConfig> = {
        items: {
          fields: {count: {type: 'integer'}},
          validation: {
            type: 'object',
            properties: {
              count: {type: 'integer'},
            },
            required: ['count'],
          },
        },
      };

      const fastify = await createTestApp(pgConfig, modelsWithRequired);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/items/',
        payload: {count: 'not-a-number'}, // should be integer
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 201 when enum value is valid', async () => {
      const modelsWithStatus: Record<string, ModelConfig> = {
        orders: {
          fields: {
            id: {type: 'integer', primaryKey: true},
            status: {type: 'enum', values: ['pending', 'shipped', 'delivered']},
          },
        },
      };

      const fastify = await createTestApp(pgConfig, modelsWithStatus);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/orders/',
        payload: {id: 1, status: 'shipped'},
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.status).toBe('shipped');

      await fastify.close();
    });

    test('should return 400 when enum value is invalid', async () => {
      const modelsWithStatus: Record<string, ModelConfig> = {
        orders: {
          fields: {
            id: {type: 'integer', primaryKey: true},
            status: {type: 'enum', values: ['pending', 'shipped', 'delivered']},
          },
        },
      };

      const fastify = await createTestApp(pgConfig, modelsWithStatus);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/orders/',
        payload: {id: 1, status: 'cancelled'}, // not in the enum values
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 404 when the post API is disabled via config', async () => {
      const fastify = await createTestApp(pgConfig, mockModels, {
        'model.v1.users.unknown.insert': {enabled: false},
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await fastify.close();
    });

    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('DB connection lost')) // INSERT
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should handle rollback failure gracefully', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('DB connection lost')) // INSERT
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when the transaction begin fails', async () => {
      const fastify = await createTestApp(pgConfig, mockModels);
      pgConnectMock.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
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
        url: '/v1/nonexistent/',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'model.v1.users.unknown.insert': {
        enabled: true,
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 201 when auth is enabled and valid token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(201);
      await fastify.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], changes: 0}) // INSERT
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        undefined,
        undefined,
        undefined,
        {
          'model.v1.users.unknown.insert': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/admin/users/',
        payload: {name: 'Test User', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toEqual({
        name: 'Test User',
        email: 'test@example.com',
      });

      await fastify.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const fastify = await createTestApp(
        pgConfig,
        mockModels,
        {
          'model.admin.users.unknown.insert': {
            enabled: false,
          },
        },
        undefined,
        undefined,
        {
          'model.v1.users.unknown.insert': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/admin/users/',
        payload: {name: 'Test', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});
