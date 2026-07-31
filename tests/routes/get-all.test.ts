import {beforeEach, describe, expect, test} from 'vitest';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const getAllModel: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        query: ['sort', 'eq', 'lt', 'lte', 'gt', 'gte', 'in', 'ne', 'not_in'],
      },
      name: {
        type: 'string',
        apis: ['search'],
        query: ['sort', 'eq', 'ne'],
      },
      email: {
        type: 'string',
        query: ['eq'],
      },
    },
  },
};

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

describe('test get-all api', () => {
  beforeEach(() => {
    pgClientQueryMock.mockClear();
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should return 200 with data and pagination', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 2}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [
            {id: 1, name: 'Alice', email: 'alice@example.com'},
            {id: 2, name: 'Bob', email: 'bob@example.com'},
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data[0].name).toBe('Alice');
      expect(body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });

      await fastify.close();
    });

    test('should build the correct SELECT SQL with default pagination', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should return empty data array when no rows are found', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 0}]}) // COUNT
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.json().data.data).toEqual([]);

      await fastify.close();
    });

    test('should include correct message in the response', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.json().message).toBe(
        'Successfully retrieved records from the users table',
      );

      await fastify.close();
    });
  });

  describe('pagination', () => {
    test('should use custom page and limit values', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/v1/users/?page=2&limit=10',
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" LIMIT $1 OFFSET $2;',
        [10, 10], // page 2, limit 10 = offset 10
      );

      await fastify.close();
    });

    test('should default to page=1 when page param is 0 or missing', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?page=0'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should return pagination in the response body', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/?page=3&limit=15',
      });

      expect(response.json().data.pagination).toEqual({
        page: 3,
        limit: 15,
        total: 0,
        totalPages: 0,
      });

      await fastify.close();
    });
  });

  describe('filtering', () => {
    test('should apply _eq filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?name_eq=Alice'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "name" = $1 LIMIT $2 OFFSET $3;',
        ['Alice', 20, 0],
      );

      await fastify.close();
    });

    test('should apply _lt filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?id_lt=10'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" < $1 LIMIT $2 OFFSET $3;',
        [10, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _lte filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?id_lte=100'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" <= $1 LIMIT $2 OFFSET $3;',
        [100, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gt filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?id_gt=5'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" > $1 LIMIT $2 OFFSET $3;',
        [5, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gte filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?id_gte=1'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" >= $1 LIMIT $2 OFFSET $3;',
        [1, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _in filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?id_in=1,2,3'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" IN ($1, $2, $3) LIMIT $4 OFFSET $5;',
        [1, 2, 3, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _ne filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?name_ne=Alice'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "name" != $1 LIMIT $2 OFFSET $3;',
        ['Alice', 20, 0],
      );

      await fastify.close();
    });

    test('should apply _not_in filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/v1/users/?id_not_in=1,2,3',
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" WHERE "id" NOT IN ($1, $2, $3) LIMIT $4 OFFSET $5;',
        [1, 2, 3, 20, 0],
      );

      await fastify.close();
    });

    test('should combine multiple filters with AND', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/v1/users/?name_eq=Bob&id_gt=10',
      });

      const callArgs = pgClientQueryMock.mock.calls[2];
      expect(callArgs[0]).toContain('"name" = $1');
      expect(callArgs[0]).toContain('"id" > $2');
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1][0]).toBe('Bob');
      expect(callArgs[1][1]).toBe(10);

      await fastify.close();
    });
  });

  describe('sorting', () => {
    test('should apply ORDER BY ASC when orderBy is set', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?orderBy=name'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" ORDER BY "name" ASC LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should apply ORDER BY DESC when orderDir=desc', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/v1/users/?orderBy=id&orderDir=desc',
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" ORDER BY "id" DESC LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should not add ORDER BY clause when orderBy is absent', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?orderDir=desc'});

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 404 when the get-all API is disabled via config', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel, {
        'model.v1.users.unknown.getAll': {enabled: false},
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await fastify.close();
    });

    test('should return 500 when database query throws before BEGIN', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);
      pgClientQueryMock.mockRejectedValueOnce(new Error('Database error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when count query fails after BEGIN', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Count failed')) // COUNT fails
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should handle rollback failure gracefully after count query error', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Count failed')) // COUNT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('limit edge cases', () => {
    test('should reject limit=0 with 400 due to minimum constraint', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/?limit=0',
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 for a route that does not match any model', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/unknown-table/',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should return rows in data even when model has no filterable fields', async () => {
      const emptyModel: Record<string, ModelConfig> = {
        tags: {fields: {id: {type: 'integer'}}},
      };
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({rows: [{id: 1}], rowCount: 1}) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, emptyModel);

      const response = await fastify.inject({method: 'GET', url: '/v1/tags/'});

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);

      await fastify.close();
    });

    test('should fallback to empty array when SELECT query returns no rows property', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 0}]}) // COUNT
        .mockResolvedValueOnce({}) // SELECT (no rows property)
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({method: 'GET', url: '/v1/users/'});

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([]);

      await fastify.close();
    });

    test('should ignore unknown query params that do not match filter patterns', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/v1/users/?foo=bar'});

      // Should not have a WHERE clause for foo
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT "id", "name", "email" FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'model.v1.users.unknown.getAll': {
        enabled: true,
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        getAllModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        getAllModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);
      await fastify.close();
    });
  });

  describe('supportedQueries', () => {
    test('should work with supportedQueries restricting filter operations', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, getAllModel, {
        'model.v1.users.unknown.getAll': {
          supportedQueries: ['eq'],
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/?name_eq=Alice',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);

      // SQL should include WHERE for name_eq
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['Alice']),
      );

      await fastify.close();
    });

    test('should support supportedQueries on default endpoints', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Bob', email: 'bob@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, getAllModel, {
        'model.v1.users.unknown.getAll': {
          supportedQueries: ['lt', 'gt'],
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);

      await fastify.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 2}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [
            {id: 1, name: 'Alice', email: 'alice@example.com'},
            {id: 2, name: 'Bob', email: 'bob@example.com'},
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        getAllModel,
        undefined,
        undefined,
        undefined,
        {
          'model.v1.users.unknown.getAll': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/users/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(2);
      expect(response.json().data.data[0].name).toBe('Alice');

      await fastify.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const fastify = await createTestApp(
        pgConfig,
        getAllModel,
        {
          'model.admin.users.unknown.getAll': {
            enabled: false,
          },
        },
        undefined,
        undefined,
        {
          'model.v1.users.unknown.getAll': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/users/',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});
