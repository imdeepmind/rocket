/* eslint-disable @typescript-eslint/no-explicit-any */

import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerEmailChangeRoute} from '@/routes/auth/change-email';

import {
  AppConfig,
  AuthenticationConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

import {
  pgClientQueryMock,
  pgConnectMock,
  pgQueryMock,
} from '@tests/helpers/db-mocks';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const authModels: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      email: {type: 'string', nullable: false},
      password: {type: 'string', nullable: false},
      is_active: {type: 'boolean', default: false},
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
        isVerifiedField: 'is_active',
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
// Helper: create a Fastify instance with the change-email route wired up
// ---------------------------------------------------------------------------

async function createChangeEmailApp(
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

  const cacheStorage = new Map<string, {value: unknown; expiry?: number}>();
  (app as any).cache = {
    get: vi.fn(async (key: string) => {
      const item = cacheStorage.get(key);
      if (!item) return null;
      return item.value;
    }),
    set: vi.fn(async (key: string, value: unknown, ttlSeconds?: number) => {
      const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      cacheStorage.set(key, {value, expiry});
    }),
    delete: vi.fn(async (key: string) => {
      cacheStorage.delete(key);
    }),
  };
  (app as any).communicate = {
    sendEmail: vi.fn(async () => {}),
  };

  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);
  await app.register(otpPlugin);

  if (authentication?.enabled && authentication.provider?.type === 'up-auth') {
    registerEmailChangeRoute(app, config);
  }
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /auth/user/email', () => {
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
      const app = await createChangeEmailApp(authentication);

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createChangeEmailApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createChangeEmailApp(
        upAuthConfig,
        authModels,
        pgConfig,
        {
          'auth.users.all.emailChange': {enabled: false},
        },
      );

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('authentication', () => {
    test('should return 401 if unauthenticated', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if token is invalid', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {
          authorization: 'Bearer invalidtoken',
        },
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if user ID is missing from token payload', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const token = app.jwt.sign({email: 'alice@example.com'});

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('User ID missing in token payload');
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200, update email and isVerifiedField, and send OTP', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

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
              is_active: true,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {email: 'newalice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Email updated. OTP sent to your new email.');
      expect(body.data.requiresMfa).toBe(true);
      expect(typeof body.data.ulid).toBe('string');
      expect(body.data.ulid.length).toBeGreaterThan(0);

      // Verify the UPDATE query
      const updateCall = pgClientQueryMock.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && (call[0] as string).includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('"email" = $1');
      expect(updateQuery).toContain('"is_active" = $2');
      expect(updateQuery).toContain('WHERE "id" = $3');

      // Verify the UPDATE values
      const updateValues = (updateCall as [string, unknown[]])[1] as unknown[];
      expect(updateValues[0]).toBe('newalice@example.com');
      expect(updateValues[1]).toBe(false);
      expect(updateValues[2]).toBe(1);

      await app.close();
    });

    test('should return 200 without isVerifiedField when not configured', async () => {
      const authWithoutVerified: AuthenticationConfig = {
        ...upAuthConfig,
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
      const app = await createChangeEmailApp(authWithoutVerified);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [
            {
              id: 1,
              email: 'alice@example.com',
              password: 'hashed',
              is_active: true,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(200);

      // Verify the UPDATE query does NOT include isVerifiedField
      const updateCall = pgClientQueryMock.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && (call[0] as string).includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('"email" = $1');
      expect(updateQuery).not.toContain('"is_active"');
      expect(updateQuery).toContain('WHERE "id" = $2');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 404 if user is not found in database', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const token = app.jwt.sign({id: 999, email: 'ghost@example.com'});

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // SELECT (empty)

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });

    test('should handle rollback failure on DB error', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // SELECT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {authorization: `Bearer ${token}`},
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });

    test('should handle beginTransaction failure', async () => {
      const app = await createChangeEmailApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      pgConnectMock.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/user/email',
        headers: {authorization: `Bearer ${token}`},
        payload: {email: 'new@example.com'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });
  });
});
