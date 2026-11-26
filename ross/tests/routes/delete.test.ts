import {beforeEach, describe, expect, test} from 'vitest';

import {
  ApisConfig,
  AuthenticationConfig,
  ModelConfig,
} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const singleDeletableModel: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        apis: ['delete'],
      },
      name: {type: 'string'},
    },
  },
};

const multipleDeletableFieldsModel: Record<string, ModelConfig> = {
  posts: {
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        apis: ['delete'],
      },
      slug: {type: 'string', apis: ['delete']},
      title: {type: 'string'},
    },
  },
};

const noDeletableFieldsModel: Record<string, ModelConfig> = {
  logs: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      message: {type: 'string'},
    },
  },
};

const upAuthConfig: AuthenticationConfig = {
  enabled: true,
  jwtSecret: 'this-will-never-be-used',
  userModel: {
    modelName: 'users',
    idField: 'id',
    providerField: 'provider',
  },
  providers: [
    {
      type: 'up-auth',
      config: {
        fields: {
          emailField: 'email',
          passwordField: 'password',
          isVerifiedField: 'is_active',
        },
      },
    },
  ],
};

describe('test delete api', () => {
  beforeEach(() => {
    // Clear mock state between tests so call assertions are isolated
    pgQueryMock.mockClear();
    pgClientQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should delete a record by integer field and return 204', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/42',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "users" WHERE "id" = $1;',
        [42],
      );

      await fastify.close();
    });

    test('should delete a record by string field and return 204', async () => {
      const customModels: Record<string, ModelConfig> = {
        posts: {
          fields: {
            slug: {type: 'string', apis: ['delete']},
          },
        },
      };
      const fastify = await createTestApp(pgConfig, customModels);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/posts/slug/hello-world',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "posts" WHERE "slug" = $1;',
        ['hello-world'],
      );

      await fastify.close();
    });

    test('should register separate routes for each deletable field on a model', async () => {
      const fastify = await createTestApp(
        pgConfig,
        multipleDeletableFieldsModel,
      );

      // Delete by id
      const byId = await fastify.inject({
        method: 'DELETE',
        url: '/v1/posts/id/10',
      });
      expect(byId.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "posts" WHERE "id" = $1;',
        [10],
      );

      pgClientQueryMock.mockClear();

      // Delete by slug
      const bySlug = await fastify.inject({
        method: 'DELETE',
        url: '/v1/posts/slug/my-post',
      });
      expect(bySlug.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "posts" WHERE "slug" = $1;',
        ['my-post'],
      );

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 when the delete API is disabled via config', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel, {
        'model.v1.users.id.delete': {enabled: false},
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/42',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await fastify.close();
    });

    test('should return 404 when model has no deletable fields', async () => {
      const fastify = await createTestApp(pgConfig, noDeletableFieldsModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/logs/id/1',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 404 for a completely unknown route', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/nonexistent/field/1',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  }); // end edge cases

  describe('error handling', () => {
    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('DB connection lost')) // DELETE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(500);
      await fastify.close();
    });

    test('should handle rollback failure gracefully', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('DB connection lost')) // DELETE
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(500);
      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'model.v1.users.id.delete': {
        enabled: true,
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await fastify.close();
    });

    test('should return 401 when auth is enabled and invalid token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 204 when auth is enabled and valid token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(204);
      await fastify.close();
    });

    test('should handle api-key auth (security schema check)', async () => {
      const apiKeyAuth: AuthenticationConfig = {
        enabled: true,
        providers: [{type: 'api-key', config: {key: 'test-key'}}],
      };

      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        apiKeyAuth,
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should skip auth check when authentication.enabled is false', async () => {
      const disabledAuth: AuthenticationConfig = {
        enabled: false,
        jwtSecret: 'this-will-never-be-used',
        userModel: {
          modelName: 'users',
          idField: 'id',
          providerField: 'provider',
        },
        providers: [
          {
            type: 'up-auth',
            config: {
              fields: {
                emailField: 'email',
                passwordField: 'password',
                isVerifiedField: 'is_active',
              },
            },
          },
        ],
      };

      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        disabledAuth,
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
      });

      // Should succeed because authentication is disabled, auth check is skipped
      expect(response.statusCode).toBe(204);
      await fastify.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // DELETE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        undefined,
        undefined,
        undefined,
        {
          'model.v1.users.id.delete': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/admin/users/id/42',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');

      await fastify.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        {
          'model.admin.users.id.delete': {
            enabled: false,
          },
        },
        undefined,
        undefined,
        {
          'model.v1.users.id.delete': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/admin/users/id/42',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });

  describe('query filters and server-side params on non-unique delete routes', () => {
    const todosModel: Record<string, ModelConfig> = {
      todos: {
        fields: {
          id: {type: 'integer', primaryKey: true, apis: ['delete']},
          title: {type: 'string', query: ['eq']},
          status: {type: 'string', apis: ['delete'], query: ['eq']},
          authorId: {type: 'integer', query: ['eq']},
          secretNote: {type: 'string', secret: true, query: ['eq']},
        },
      },
    };

    const sspApis: ApisConfig = {
      'model.v1.todos.status.delete': {
        enabled: true,
        authorization: true,
        serverSideParams: [
          {type: 'query', name: 'authorId_eq', value: '[[userId]]'},
        ],
      },
    };

    test('should apply query filter to delete query on non-unique field', async () => {
      const fastify = await createTestApp(pgConfig, todosModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?authorId_eq=7',
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1 AND "authorId" = $2;',
        ['archived', 7],
      );

      await fastify.close();
    });

    test('should apply multiple query filters to delete query on non-unique field', async () => {
      const fastify = await createTestApp(pgConfig, todosModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?authorId_eq=7&title_eq=done',
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1 AND "authorId" = $2 AND "title" = $3;',
        ['archived', 7, 'done'],
      );

      await fastify.close();
    });

    test('should not apply query filters when deleting by unique primary key field', async () => {
      const fastify = await createTestApp(pgConfig, todosModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/id/42?authorId_eq=7',
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "id" = $1;',
        [42],
      );

      await fastify.close();
    });

    test('should ignore unknown query params on non-unique field', async () => {
      const fastify = await createTestApp(pgConfig, todosModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?unknown_param=foo',
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1;',
        ['archived'],
      );

      await fastify.close();
    });

    test('should inject [userId] as a query filter via SSP on non-unique delete route', async () => {
      const fastify = await createTestApp(
        pgConfig,
        todosModel,
        sspApis,
        undefined,
        upAuthConfig,
      );
      const token = fastify.jwt.sign({id: 7, email: 'alice@example.com'});

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived',
        headers: {authorization: `Bearer ${token}`},
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1 AND "authorId" = $2;',
        ['archived', 7],
      );

      await fastify.close();
    });

    test('should override client query value with server-side SSP on non-unique delete route', async () => {
      const fastify = await createTestApp(
        pgConfig,
        todosModel,
        sspApis,
        undefined,
        upAuthConfig,
      );
      const token = fastify.jwt.sign({id: 7, email: 'alice@example.com'});

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?authorId_eq=999',
        headers: {authorization: `Bearer ${token}`},
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1 AND "authorId" = $2;',
        ['archived', 7],
      );

      await fastify.close();
    });

    test('should reject invalid query param type with 400 on non-unique field', async () => {
      const fastify = await createTestApp(pgConfig, todosModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?authorId_eq=not-an-integer',
      });

      expect(response.statusCode).toBe(400);
      expect(pgClientQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should include secret fields in query filter when bypassSecret is true on non-unique route', async () => {
      const fastify = await createTestApp(pgConfig, todosModel, {
        'model.v1.todos.status.delete': {
          bypassSecret: true,
        },
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/v1/todos/status/archived?secretNote_eq=foo',
      });

      expect(response.statusCode).toBe(204);
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "todos" WHERE "status" = $1 AND "secretNote" = $2;',
        ['archived', 'foo'],
      );

      await fastify.close();
    });
  });
});
