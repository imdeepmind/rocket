/* eslint-disable @typescript-eslint/no-explicit-any */

import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import jwt from 'jsonwebtoken';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerLoginRoute} from '@/routes/auth/login';

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
    table: 'users',
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
// Helpers: create a bare Fastify instance with the login route wired up
// ---------------------------------------------------------------------------

async function createAuthApp(
  authentication: AuthenticationConfig,
  models: Record<string, ModelConfig> = authModels,
  dbConfig: DatabaseConfig = pgConfig,
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
    infrastructure: {primaryDatabase: dbConfig},
    data: {models},
    authentication,
  };
  app.appConfig = config;
  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);

  registerLoginRoute(app, config);
  await app.ready();
  return app;
}

async function createAuthAppWithMfa(
  authentication: AuthenticationConfig,
  models: Record<string, ModelConfig> = authModels,
  dbConfig: DatabaseConfig = pgConfig,
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
    infrastructure: {primaryDatabase: dbConfig},
    data: {models},
    authentication,
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

  registerLoginRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
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
        url: '/auth/login',
        payload: {email: 'test@example.com', password: 'password'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and a JWT on successful login', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock DB: user exists
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      // Mock bcrypt: password matches
      const compareSpy = vi
        .spyOn(bcrypt, 'compare')
        .mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'p@ssw0rd'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Login successful');
      expect(body.data.accessToken).toBeDefined();

      // Verify JWT payload
      const secret = 'this-will-never-be-used';
      const decoded = jwt.verify(body.data.accessToken, secret) as Record<
        string,
        unknown
      >;
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('alice@example.com');

      expect(compareSpy).toHaveBeenCalledWith('p@ssw0rd', 'hashed_password');
      await app.close();
    });

    test('should use custom tokenExpiration when configured', async () => {
      const authWithExpiration: AuthenticationConfig = {
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
            tokenExpiration: '2h',
          },
        },
      };
      const app = await createAuthApp(authWithExpiration);

      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'p@ssw0rd'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.accessToken).toBeDefined();

      const secret = 'this-will-never-be-used';
      const decoded = jwt.verify(body.data.accessToken, secret) as Record<
        string,
        unknown
      >;
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('alice@example.com');

      // Verify expiration is ~2 hours from iat (within a small tolerance)
      const iat = decoded.iat as number;
      const exp = decoded.exp as number;
      const diffSeconds = exp - iat;
      // 2 hours = 7200 seconds, allow 1 second tolerance
      expect(diffSeconds).toBe(7200);

      await app.close();
    });

    test('should use default 1d expiration when tokenExpiration not set', async () => {
      const app = await createAuthApp(upAuthConfig);

      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'p@ssw0rd'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.accessToken).toBeDefined();

      const secret = 'this-will-never-be-used';
      const decoded = jwt.verify(body.data.accessToken, secret) as Record<
        string,
        unknown
      >;
      // 1 day = 86400 seconds, allow 1 second tolerance
      const iat = decoded.iat as number;
      const exp = decoded.exp as number;
      expect(exp - iat).toBe(86400);

      await app.close();
    });
  });

  describe('MFA login flow', () => {
    test('should return requiresMfa and ulid when mfaRequired is true', async () => {
      const mfaAuthConfig: AuthenticationConfig = {
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
            mfaRequired: true,
          },
        },
      };
      const app = await createAuthAppWithMfa(mfaAuthConfig);

      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'p@ssw0rd'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Login successful. OTP sent to your email.');
      expect(body.data.requiresMfa).toBe(true);
      expect(typeof body.data.ulid).toBe('string');
      expect(body.data.ulid.length).toBeGreaterThan(0);
      expect(body.data.accessToken).toBeUndefined();

      await app.close();
    });

    test('should return 401 when MFA required and password is wrong', async () => {
      const mfaAuthConfig: AuthenticationConfig = {
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
            mfaRequired: true,
          },
        },
      };
      const app = await createAuthAppWithMfa(mfaAuthConfig);

      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'wrong'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid username or password');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 401 if user is not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock DB: no user
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'nonexistent@example.com', password: 'any'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid username or password');
      await app.close();
    });

    test('should return 401 if password does not match', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock DB: user exists
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      // Mock bcrypt: password mismatch
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com', password: 'wrong_password'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid username or password');
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 if required fields are missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {email: 'alice@example.com'}, // missing password
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
