import {beforeEach, describe, expect, test} from 'vitest';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const singleDeletableModel: Record<string, ModelConfig> = {
  users: {
    table: 'users',
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        operations: ['delete'],
      },
      name: {type: 'string'},
    },
  },
};

const multipleDeletableFieldsModel: Record<string, ModelConfig> = {
  posts: {
    table: 'posts',
    fields: {
      id: {
        type: 'integer',
        primaryKey: true,
        operations: ['delete'],
      },
      slug: {type: 'string', operations: ['delete']},
      title: {type: 'string'},
    },
  },
};

const noDeletableFieldsModel: Record<string, ModelConfig> = {
  logs: {
    table: 'logs',
    fields: {
      id: {type: 'integer', primaryKey: true},
      message: {type: 'string'},
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

describe('test delete api', () => {
  beforeEach(() => {
    // Clear mock state between tests so call assertions are isolated
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should delete a record by integer field and return 204', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/users/id/42',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'DELETE FROM "users" WHERE "id" = $1;',
        [42],
      );

      await fastify.close();
    });

    test('should delete a record by string field and return 204', async () => {
      const customModels: Record<string, ModelConfig> = {
        posts: {
          table: 'posts',
          fields: {
            slug: {type: 'string', operations: ['delete']},
          },
        },
      };
      const fastify = await createTestApp(pgConfig, customModels);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/posts/slug/hello-world',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
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
        url: '/posts/id/10',
      });
      expect(byId.statusCode).toBe(204);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'DELETE FROM "posts" WHERE "id" = $1;',
        [10],
      );

      pgQueryMock.mockClear();

      // Delete by slug
      const bySlug = await fastify.inject({
        method: 'DELETE',
        url: '/posts/slug/my-post',
      });
      expect(bySlug.statusCode).toBe(204);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'DELETE FROM "posts" WHERE "slug" = $1;',
        ['my-post'],
      );

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 when model has no deletable fields', async () => {
      const fastify = await createTestApp(pgConfig, noDeletableFieldsModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/logs/id/1',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 404 for a completely unknown route', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/nonexistent/field/1',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  }); // end edge cases

  describe('error handling', () => {
    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, singleDeletableModel);
      pgQueryMock.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/users/id/1',
      });

      expect(response.statusCode).toBe(500);
      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'modelAPIs->users->id->delete': {
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
        url: '/users/id/1',
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
        url: '/users/id/1',
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
        url: '/users/id/1',
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
        provider: {
          type: 'api-key',
          config: {key: 'test-key'},
        },
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
        url: '/users/id/1',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should skip auth check when authentication.enabled is false', async () => {
      const disabledAuth: AuthenticationConfig = {
        enabled: false,
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

      const fastify = await createTestApp(
        pgConfig,
        singleDeletableModel,
        apisConfig,
        undefined,
        disabledAuth,
      );

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/users/id/1',
      });

      // Should succeed because authentication is disabled, auth check is skipped
      expect(response.statusCode).toBe(204);
      await fastify.close();
    });
  });
});
