import {beforeEach, describe, expect, test} from 'vitest';

import {AuthConfig, ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const singleDeletableModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: ['deletable'],
      },
      {name: 'name', type: 'string'},
    ],
  },
];

const multipleDeletableFieldsModel: ModelConfig[] = [
  {
    name: 'posts',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: ['deletable'],
      },
      {name: 'slug', type: 'string', supportedOperations: ['deletable']},
      {name: 'title', type: 'string'},
    ],
  },
];

const noDeletableFieldsModel: ModelConfig[] = [
  {
    name: 'logs',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {name: 'message', type: 'string'},
    ],
  },
];

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
      const customModels: ModelConfig[] = [
        {
          name: 'posts',
          fields: [
            {name: 'slug', type: 'string', supportedOperations: ['deletable']},
          ],
        },
      ];
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
      'modelAPIs->delete->users': {
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
      const apiKeyAuth: AuthConfig = {
        enableAuth: true,
        authEngine: 'api-key',
        authModel: {
          modelName: 'users',
          idColumn: 'id',
          usernameColumn: 'email',
          passwordColumn: 'password',
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
  });
});
