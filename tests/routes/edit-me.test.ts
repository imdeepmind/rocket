import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerEditMeRoute} from '@/routes/auth/edit-me';

import {
  AppConfig,
  AuthenticationConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const authModels: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      email: {type: 'string', nullable: false},
      password: {type: 'string', nullable: false},
      name: {type: 'string', nullable: true},
      avatar: {type: 'string', nullable: true},
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

const pgConfig: DatabaseConfig = {
  engine: 'postgres',
  connection: {
    url: 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
};

// ---------------------------------------------------------------------------
// Helper: create a Fastify instance with the edit-me route wired up
// ---------------------------------------------------------------------------

async function createEditMeApp(
  authentication: AuthenticationConfig,
  models: Record<string, ModelConfig> = authModels,
  dbConfig: DatabaseConfig = pgConfig,
  apis?: Record<string, {enabled: boolean}>,
  apiVariants?: Record<string, {variants: string[]}>,
): Promise<FastifyInstance> {
  const app = Fastify();
  const config: AppConfig = {
    application: {name: 'Test App', logLevel: 'error'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', description: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {database: dbConfig},
    data: {models},
    authentication,
    ...(apis ? {apis} : {}),
    ...(apiVariants ? {apiVariants} : {}),
  };
  app.appConfig = config;
  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);

  if (authentication?.enabled && authentication.provider?.type === 'up-auth') {
    registerEditMeRoute(app, config);
  }
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /auth/user/me', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
    pgClientQueryMock.mockClear();
    vi.restoreAllMocks();
  });

  describe('guard conditions', () => {
    test('should NOT register the route when enabled is false', async () => {
      const authentication: AuthenticationConfig = {
        ...upAuthConfig,
        enabled: false,
      };
      const app = await createEditMeApp(authentication);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createEditMeApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createEditMeApp(upAuthConfig, authModels, pgConfig, {
        'auth.v1.users.unknown.editMe': {enabled: false},
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('authentication', () => {
    test('should return 401 if unauthenticated', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if token is invalid', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {
          authorization: 'Bearer invalidtoken',
        },
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if user ID is missing from token payload', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const token = app.jwt.sign({email: 'alice@example.com'});

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'New Name'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('User ID missing in token payload');
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and update editable fields', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      // Mock transaction: BEGIN, SELECT (user exists), UPDATE, COMMIT
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [
            {
              id: 1,
              email: 'alice@example.com',
              password: 'hashed',
              name: 'Alice',
              avatar: null,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'Alice Smith', avatar: 'alice.png'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('User profile updated successfully');
      expect(body.data).toEqual({name: 'Alice Smith', avatar: 'alice.png'});

      // Verify the UPDATE query excludes protected fields
      const updateCall = pgClientQueryMock.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && (call[0] as string).includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('"name" = $1');
      expect(updateQuery).toContain('"avatar" = $2');
      expect(updateQuery).not.toContain('SET "id"');
      expect(updateQuery).not.toContain('"email" =');
      expect(updateQuery).not.toContain('"password" =');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 400 when body contains only protected fields', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {id: 1, email: 'new@example.com', password: 'newpass'},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('No editable fields provided');
      await app.close();
    });

    test('should return 404 if user is not found in database', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 999, email: 'ghost@example.com'});

      // Mock transaction: BEGIN, SELECT (no user), ROLLBACK
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // SELECT (empty)

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {name: 'Ghost'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });

    test('should handle rollback failure on DB error', async () => {
      const app = await createEditMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // SELECT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/auth/user/me',
        headers: {authorization: `Bearer ${token}`},
        payload: {name: 'Alice'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      const app = await createEditMeApp(
        upAuthConfig,
        undefined,
        undefined,
        undefined,
        {
          'auth.v1.users.unknown.editMe': {
            variants: ['admin'],
          },
        },
      );
      const token = app.jwt.sign({id: 1, email: 'admin@example.com'});
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              email: 'admin@example.com',
              password: 'hashed',
              name: 'Admin',
              avatar: null,
            },
          ],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/auth/user/me',
        headers: {authorization: `Bearer ${token}`},
        payload: {name: 'New Name'},
      });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const app = await createEditMeApp(
        upAuthConfig,
        undefined,
        undefined,
        {'auth.admin.users.unknown.editMe': {enabled: false}},
        {'auth.v1.users.unknown.editMe': {variants: ['admin']}},
      );
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/auth/user/me',
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});
