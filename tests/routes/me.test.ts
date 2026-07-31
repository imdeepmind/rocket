import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerMeRoute} from '@/routes/auth/me';

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
      password: {type: 'string', nullable: false, secret: true},
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
// Helper: create a Fastify instance with the me route wired up
// ---------------------------------------------------------------------------

async function createMeApp(
  authentication: AuthenticationConfig,
  models: Record<string, ModelConfig> = authModels,
  dbConfig: DatabaseConfig = pgConfig,
  apis?: Record<string, {enabled?: boolean; bypassSecret?: boolean}>,
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
    registerMeRoute(app, config);
  }
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /auth/user/me', () => {
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
      const app = await createMeApp(authentication);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createMeApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createMeApp(upAuthConfig, authModels, pgConfig, {
        'auth.v1.users.unknown.me': {enabled: false},
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('authentication', () => {
    test('should return 401 if unauthenticated', async () => {
      const app = await createMeApp(upAuthConfig);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if token is invalid', async () => {
      const app = await createMeApp(upAuthConfig);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
        headers: {
          authorization: 'Bearer invalidtoken',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
      await app.close();
    });

    test('should return 401 if user ID is missing from token payload', async () => {
      const app = await createMeApp(upAuthConfig);

      const token = app.jwt.sign({email: 'alice@example.com'});

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('User ID missing in token payload');
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and user data when user exists', async () => {
      const app = await createMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      const mockUser = {
        id: 1,
        email: 'alice@example.com',
        password: 'hashed_password',
      };
      pgQueryMock.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('User profile retrieved successfully');
      expect(body.data).toEqual({id: 1, email: 'alice@example.com'});

      const selectArg = pgQueryMock.mock.calls[0][0] as string;
      expect(selectArg).not.toContain('password');

      await app.close();
    });

    test('should return secret fields when bypassSecret is enabled', async () => {
      const app = await createMeApp(upAuthConfig, authModels, pgConfig, {
        'auth.v1.users.unknown.me': {
          bypassSecret: true,
        },
      });

      const token = app.jwt.sign({id: 1, email: 'alice@example.com'});

      const mockUser = {
        id: 1,
        email: 'alice@example.com',
        password: 'hashed_password',
      };
      pgQueryMock.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(mockUser);

      const selectArg = pgQueryMock.mock.calls[0][0] as string;
      expect(selectArg).toContain('"password"');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 404 if user is not found in database', async () => {
      const app = await createMeApp(upAuthConfig);

      const token = app.jwt.sign({id: 999, email: 'ghost@example.com'});

      pgQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      const app = await createMeApp(
        upAuthConfig,
        authModels,
        pgConfig,
        undefined,
        {
          'auth.v1.users.unknown.me': {
            variants: ['admin'],
          },
        },
      );

      const token = app.jwt.sign({id: 1, email: 'admin@example.com'});
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 1, email: 'admin@example.com', password: 'hash'}],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    test('should exclude secret fields on variant endpoint unless bypassSecret is set', async () => {
      const app = await createMeApp(
        upAuthConfig,
        authModels,
        pgConfig,
        {
          'auth.admin.users.unknown.me': {
            bypassSecret: true,
          },
        },
        {
          'auth.v1.users.unknown.me': {
            variants: ['admin'],
          },
        },
      );

      const token = app.jwt.sign({id: 1, email: 'admin@example.com'});
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 1, email: 'admin@example.com', password: 'hash'}],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/auth/user/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        id: 1,
        email: 'admin@example.com',
        password: 'hash',
      });

      const selectArg = pgQueryMock.mock.calls[0][0] as string;
      expect(selectArg).toContain('"password"');

      await app.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const app = await createMeApp(
        upAuthConfig,
        authModels,
        pgConfig,
        {
          'auth.admin.users.unknown.me': {
            enabled: false,
          },
        },
        {
          'auth.v1.users.unknown.me': {
            variants: ['admin'],
          },
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/admin/auth/user/me',
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});
