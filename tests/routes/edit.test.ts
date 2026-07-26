import {beforeEach, describe, expect, test} from 'vitest';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

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

const defaultEditModel: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        apis: ['edit'],
      },
      name: {type: 'string'},
      email: {type: 'string'},
    },
  },
};

const nonUniqueEditModel: Record<string, ModelConfig> = {
  tasks: {
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        query: ['lt', 'lte', 'gt', 'gte', 'in', 'ne', 'not_in'],
      },
      status: {
        type: 'string',
        apis: ['edit'],
        query: ['eq', 'lt', 'ne'], // Non-unique identifier
      },
      title: {type: 'string', query: ['eq']},
    },
  },
};

const validatedEditModel: Record<string, ModelConfig> = {
  posts: {
    validation: {
      type: 'object',
      properties: {
        title: {type: 'string'},
        content: {type: 'string'},
      },
      required: ['title', 'content'],
    },
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        apis: ['edit'],
      },
      title: {type: 'string'},
      content: {type: 'string'},
    },
  },
};

describe('test edit api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
    pgClientQueryMock.mockClear();
  });

  describe('PATCH partial updates', () => {
    test('should return 200 on successful PATCH update', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          name: 'Bob',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({name: 'Bob'});
      expect(response.json().message).toBe(
        'Successfully updated records in the users table',
      );

      await fastify.close();
    });

    test('should build the correct UPDATE SQL for PATCH', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/users/id/5',
        payload: {
          email: 'bob@example.com',
          name: 'Bob',
        },
      });

      const callArgs = pgClientQueryMock.mock.calls[1];
      // Note: order of keys is not guaranteed by Object.keys, but usually preserved
      expect(callArgs[0]).toMatch(
        /UPDATE "users" SET ".*" = \$1, ".*" = \$2 WHERE "id" = \$3/,
      );
      expect(callArgs[1].length).toBe(3);
      expect(callArgs[1]).toContain(5); // The id path param should be the last param

      await fastify.close();
    });

    test('should return 400 when body is empty', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should remove the identifying field from the body if mistakenly provided', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          id: 999, // User trying to edit the ID
          name: 'Alice',
        },
      });

      // The update query should only set "name"
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "users" SET "name" = $1 WHERE "id" = $2',
        ['Alice', 1],
      );

      await fastify.close();
    });
  });

  describe('PUT complete updates', () => {
    test('should return 200 on successful PUT update with all required fields', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {
          name: 'Charlie',
          email: 'charlie@example.com',
        },
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });

    test('should return 400 if a required field is missing in PUT request', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {
          name: 'Charlie',
          // email is missing, but required for PUT
        },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe('custom validation logic', () => {
    test('should respect custom model validation for PUT', async () => {
      const fastify = await createTestApp(pgConfig, validatedEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/posts/id/1',
        payload: {
          title: 'Title',
          // content is missing, validation requires both
        },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should allow partial custom validation for PATCH (required removed)', async () => {
      const fastify = await createTestApp(pgConfig, validatedEditModel);

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/posts/id/1',
        payload: {
          title: 'Only Title', // content is missing, but PATCH removes required array
        },
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });
  });

  describe('filtering on non-unique edit routes', () => {
    test('should apply query filters to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_lt=10', // editing tasks with status pending AND id < 10
        payload: {
          title: 'Urgent Pending Task',
        },
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" < $3',
        ['Urgent Pending Task', 'pending', 10],
      );

      await fastify.close();
    });

    test('should apply _lte filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_lte=5',
        payload: {title: 'Update'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" <= $3',
        ['Update', 'pending', 5],
      );

      await fastify.close();
    });

    test('should apply _gt filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_gt=1',
        payload: {title: 'Update'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" > $3',
        ['Update', 'pending', 1],
      );

      await fastify.close();
    });

    test('should apply _gte filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_gte=2',
        payload: {title: 'Update'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" >= $3',
        ['Update', 'pending', 2],
      );

      await fastify.close();
    });

    test('should ignore pagination and sorting params in the query string', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?page=1&limit=10&orderBy=id&orderDir=asc',
        payload: {
          title: 'Ignored Params Task',
        },
      });

      // Query should not include page, limit, or order stuff in WHERE
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2',
        ['Ignored Params Task', 'pending'],
      );

      await fastify.close();
    });

    test('should apply _ne filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_ne=10',
        payload: {title: 'Update'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" != $3',
        ['Update', 'pending', 10],
      );

      await fastify.close();
    });

    test('should apply _not_in filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_not_in=1,2,3',
        payload: {title: 'Update'},
      });

      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" NOT IN ($3, $4, $5)',
        ['Update', 'pending', 1, 2, 3],
      );

      await fastify.close();
    });

    test('should apply multiple filter params (_eq, _in)', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?title_eq=foo&id_in=1,2,3',
        payload: {
          title: 'Bulk updated foo',
        },
      });

      const callArgs = pgClientQueryMock.mock.calls[1];
      expect(callArgs[0]).toContain(
        'WHERE "status" = $2 AND "title" = $3 AND "id" IN ($4, $5, $6)',
      );

      await fastify.close();
    });
  });

  describe('error handling / edge cases', () => {
    test('should return 404 when PATCH updates zero rows (record not found)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/999',
        payload: {name: 'Nobody'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe(
        'No users record found matching the given criteria',
      );

      await fastify.close();
    });

    test('should return 404 when PUT updates zero rows (record not found)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/999',
        payload: {name: 'Nobody', email: 'nobody@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe(
        'No users record found matching the given criteria',
      );

      await fastify.close();
    });

    test('should return 200 when PATCH updates a record successfully', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Found'},
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });

    test('should return 404 when the edit API is disabled via config', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel, {
        'model.users.id.edit': {enabled: false},
      });

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await fastify.close();
    });

    test('should return 400 for unknown keys in body (schema rejects them)', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          unknownField: 'value',
        },
      });

      // with additionalProperties: false, Fastify rejects the request with 400
      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.message || json.error).toBeDefined();

      await fastify.close();
    });

    test('should return 404 for fields without editable operation', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/name/Alice', // name is not editable identifying field
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });

  describe('error handling during database operations', () => {
    test('should return 500 when UPDATE query fails after BEGIN (PATCH)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Update failed')) // UPDATE fails
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK succeeds

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should handle rollback failure gracefully after UPDATE error (PATCH)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Update failed')) // UPDATE fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when UPDATE query fails after BEGIN (PUT)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Update failed')) // UPDATE fails
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK succeeds

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {name: 'Bob', email: 'bob@example.com'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when BEGIN itself fails (PATCH)', async () => {
      pgClientQueryMock.mockRejectedValueOnce(new Error('BEGIN failed')); // BEGIN fails

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'model.users.id.edit': {
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided (PATCH)', async () => {
      const fastify = await createTestApp(
        pgConfig,
        defaultEditModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 401 when auth is enabled and no token is provided (PUT)', async () => {
      const fastify = await createTestApp(
        pgConfig,
        defaultEditModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {name: 'Bob', email: 'bob@example.com'},
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided (PATCH)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        defaultEditModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'Bob'},
      });

      expect(response.statusCode).toBe(200);
      await fastify.close();
    });
  });
});
