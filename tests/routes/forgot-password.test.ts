/* eslint-disable @typescript-eslint/no-explicit-any */

import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerForgotPasswordRoute} from '@/routes/auth/forgot-password';

import {
  AppConfig,
  AuthenticationConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';

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
// Helper: create a Fastify instance with forgot-password route wired up
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

  registerForgotPasswordRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
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
        url: '/auth/forgot-password',
        payload: {email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createAuthApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createAuthApp(upAuthConfig, authModels, pgConfig, {
        'auth.users.all.forgotPassword': {enabled: false},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and ulid when user exists', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock DB: user exists
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP sent to your email.');
      expect(body.data.requiresMfa).toBe(true);
      expect(typeof body.data.ulid).toBe('string');
      expect(body.data.ulid.length).toBeGreaterThan(0);

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 404 if user is not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock DB: no user
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {email: 'nonexistent@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 if email is missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
