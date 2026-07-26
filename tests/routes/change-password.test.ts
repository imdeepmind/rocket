import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerChangePasswordRoute} from '@/routes/auth/change-password';

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
// Helper: create a bare Fastify instance with the change-password route wired up
// ---------------------------------------------------------------------------

async function createAuthApp(
  authentication: AuthenticationConfig,
  models: Record<string, ModelConfig> = authModels,
  dbConfig: DatabaseConfig = pgConfig,
  apis?: Record<string, {enabled: boolean}>,
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
  };
  app.appConfig = config;
  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);

  if (authentication?.enabled && authentication.provider?.type === 'up-auth') {
    registerChangePasswordRoute(app, config);
  }
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/change-password', () => {
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
      const app = await createAuthApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createAuthApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createAuthApp(upAuthConfig, authModels, pgConfig, {
        'auth.users.all.changePassword': {enabled: false},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 on successful password change', async () => {
      const app = await createAuthApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      // Mock transaction: BEGIN, SELECT (user exists), UPDATE, COMMIT
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [
            {id: 1, email: 'alice@example.com', password: 'hashed_password'},
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      // Mock bcrypt: password matches
      const compareSpy = vi
        .spyOn(bcrypt, 'compare')
        .mockResolvedValue(true as never);

      // Mock bcrypt: hash
      const hashSpy = vi
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('new_hashed_password' as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          existingPassword: 'old_password',
          newPassword: 'new_password',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Password changed successfully');
      expect(body.data.success).toBe(true);

      expect(compareSpy).toHaveBeenCalledWith(
        'old_password',
        'hashed_password',
      );
      expect(hashSpy).toHaveBeenCalledWith('new_password', 10);

      // Select query check (inside transaction)
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" = $1 LIMIT 1;',
        [1],
      );
      // Update query check (inside transaction)
      expect(pgClientQueryMock).toHaveBeenCalledWith(
        'UPDATE "users" SET "password" = $1 WHERE "id" = $2;',
        ['new_hashed_password', 1],
      );

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 401 if unauthenticated', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if token is invalid', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: 'Bearer invalidtoken',
        },
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if user ID is missing from token payload', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Token missing 'id'
      const token = app.jwt.sign({email: 'alice@example.com'});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('User ID missing in token payload');
      await app.close();
    });

    test('should return 404 if user is not found in database', async () => {
      const app = await createAuthApp(upAuthConfig);
      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      // Mock transaction: BEGIN, SELECT (no user), ROLLBACK
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // SELECT (empty)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });

    test('should handle rollback failure on DB error', async () => {
      const app = await createAuthApp(upAuthConfig);
      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // SELECT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {authorization: `Bearer ${token}`},
        payload: {existingPassword: 'old', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });

    test('should return 401 if existing password does not match', async () => {
      const app = await createAuthApp(upAuthConfig);
      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      // Mock transaction: BEGIN, SELECT (user exists), ROLLBACK
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [
            {id: 1, email: 'alice@example.com', password: 'hashed_password'},
          ],
          rowCount: 1,
        });

      // Mock bcrypt: password mismatch
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {existingPassword: 'wrong_password', newPassword: 'new'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid existing password');
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 if required fields are missing', async () => {
      const app = await createAuthApp(upAuthConfig);
      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {existingPassword: 'old'}, // missing newPassword
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
