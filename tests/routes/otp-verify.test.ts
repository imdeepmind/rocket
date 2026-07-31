/* eslint-disable @typescript-eslint/no-explicit-any */

import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import jwt from 'jsonwebtoken';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {
  registerForgotPasswordOtpVerifyRoute,
  registerLoginOtpVerifyRoute,
  registerRegistrationOtpVerifyRoute,
} from '@/routes/auth/otp-verify';

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
// Helper: create a Fastify instance with otp-verify routes wired up
// ---------------------------------------------------------------------------

async function createOtpApp(
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
    registerLoginOtpVerifyRoute(app, config);
    registerRegistrationOtpVerifyRoute(app, config);
    registerForgotPasswordOtpVerifyRoute(app, config);
  }
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/login/verify/otp', () => {
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
      const app = await createOtpApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid: 'test-ulid', otp: '123456', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when model is not found in models', async () => {
      const app = await createOtpApp(upAuthConfig, {});

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid: 'test-ulid', otp: '123456', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when the API is disabled via apis config', async () => {
      const app = await createOtpApp(upAuthConfig, authModels, pgConfig, {
        'auth.v1.users.unknown.otpVerifyLogin': {enabled: false},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid: 'test-ulid', otp: '123456', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and a JWT on successful OTP verification', async () => {
      const app = await createOtpApp(upAuthConfig);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [
            {id: 1, email: 'alice@example.com', password: 'hashed_password'},
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP verification successful');
      expect(body.data.accessToken).toBeDefined();

      const secret = 'this-will-never-be-used';
      const decoded = jwt.verify(body.data.accessToken, secret) as Record<
        string,
        unknown
      >;
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('alice@example.com');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 401 with invalid OTP', async () => {
      const app = await createOtpApp(upAuthConfig);

      await app.otp.sendOTPForVerification('alice@example.com');
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {
          ulid: 'wrong-ulid',
          otp: '000000',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid or expired OTP');
      await app.close();
    });

    test('should return 401 with expired OTP', async () => {
      const app = await createOtpApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {
          ulid: 'nonexistent-ulid',
          otp: '000000',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid or expired OTP');
      await app.close();
    });

    test('should return 400 if required fields are missing', async () => {
      const app = await createOtpApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid: 'test-ulid'},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should handle rollback failure on DB error', async () => {
      const app = await createOtpApp(upAuthConfig);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // SELECT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });

    test('should return 401 when user is not found in the database', async () => {
      const app = await createOtpApp(upAuthConfig);

      // Send a valid OTP first
      const sendResponse = await app.otp.sendOTPForVerification(
        'unknown@example.com',
      );
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      // Mock bcrypt.compare so OTP verification succeeds
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      // Mock transaction: BEGIN, SELECT (no user), ROLLBACK
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // SELECT (empty)

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login/verify/otp',
        payload: {ulid, otp: '000000', email: 'unknown@example.com'},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('User not found');
      await app.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        undefined,
        {
          'auth.v1.users.unknown.otpVerifyLogin': {
            variants: ['admin'],
          },
        },
      );
      const sendResponse =
        await app.otp.sendOTPForVerification('admin@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{id: 1, email: 'admin@example.com', password: 'hashed'}],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/login/verify/otp',
        payload: {ulid, otp: '000000', email: 'admin@example.com'},
      });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        {'auth.admin.users.unknown.otpVerifyLogin': {enabled: false}},
        {'auth.v1.users.unknown.otpVerifyLogin': {variants: ['admin']}},
      );
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/login/verify/otp',
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});

describe('POST /auth/register/verify/otp', () => {
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
      const app = await createOtpApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {ulid: 'test-ulid', otp: '123456', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and flip isVerifiedField on successful OTP verification', async () => {
      const app = await createOtpApp(upAuthConfig);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      // Mock transaction: BEGIN, SELECT, UPDATE, COMMIT
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [{id: 1, email: 'alice@example.com', is_active: false}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP verification successful');

      // No access token for registration verification
      expect(body.data).toBeNull();

      // Verify the UPDATE query was executed
      const updateCall = pgClientQueryMock.mock.calls.find(call => {
        const [query] = call;
        return (
          typeof query === 'string' && (query as string).includes('UPDATE')
        );
      });
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('UPDATE "users"');
      expect(updateQuery).toContain('"is_active" = true');

      await app.close();
    });

    test('should set updated_at when the auth model has an updated_at field', async () => {
      const modelsWithTimestamps: Record<string, ModelConfig> = {
        users: {
          fields: {
            id: {type: 'integer', primaryKey: true},
            email: {type: 'string', nullable: false},
            password: {type: 'string', nullable: false},
            is_active: {type: 'boolean', default: false},
            updated_at: {type: 'datetime'},
          },
        },
      };
      const app = await createOtpApp(upAuthConfig, modelsWithTimestamps);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              email: 'alice@example.com',
              is_active: false,
              updated_at: null,
            },
          ],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);

      const updateCall = pgClientQueryMock.mock.calls.find(call => {
        const [query] = call;
        return (
          typeof query === 'string' && (query as string).includes('UPDATE')
        );
      });
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('UPDATE "users"');
      expect(updateQuery).toContain('"is_active" = true');
      expect(updateQuery).toContain('"updated_at" = now()');

      await app.close();
    });

    test('should return 200 without UPDATE when isVerifiedField is not configured', async () => {
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
      const app = await createOtpApp(authWithoutVerified);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      // Mock transaction: BEGIN, SELECT, COMMIT
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [{id: 1, email: 'alice@example.com', password: 'hashed'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP verification successful');
      expect(body.data).toBeNull();

      // No UPDATE query should have been executed
      const updateCall = pgClientQueryMock.mock.calls.find(call => {
        const [query] = call;
        return (
          typeof query === 'string' && (query as string).includes('UPDATE')
        );
      });
      expect(updateCall).toBeUndefined();

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 401 with invalid OTP', async () => {
      const app = await createOtpApp(upAuthConfig);

      await app.otp.sendOTPForVerification('alice@example.com');
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {
          ulid: 'wrong-ulid',
          otp: '000000',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid or expired OTP');
      await app.close();
    });

    test('should return 400 if required fields are missing', async () => {
      const app = await createOtpApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/verify/otp',
        payload: {ulid: 'test-ulid'},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        undefined,
        {
          'auth.v1.users.unknown.otpVerifyRegister': {
            variants: ['admin'],
          },
        },
      );
      const sendResponse =
        await app.otp.sendOTPForVerification('admin@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{id: 1, email: 'admin@example.com', is_active: false}],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/register/verify/otp',
        payload: {ulid, otp: '000000', email: 'admin@example.com'},
      });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        {'auth.admin.users.unknown.otpVerifyRegister': {enabled: false}},
        {'auth.v1.users.unknown.otpVerifyRegister': {variants: ['admin']}},
      );
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/register/verify/otp',
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});

describe('POST /auth/forgot-password/verify/otp', () => {
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
      const app = await createOtpApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password/verify/otp',
        payload: {
          ulid: 'test-ulid',
          otp: '123456',
          email: 'test@example.com',
          newPassword: 'newPass123',
        },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and update password on successful OTP verification', async () => {
      const app = await createOtpApp(upAuthConfig);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      // Mock transaction: BEGIN, SELECT, UPDATE, COMMIT
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT
          rows: [{id: 1, email: 'alice@example.com', password: 'old_hashed'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue(
        'new_hashed_password' as never,
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password/verify/otp',
        payload: {
          ulid,
          otp: '000000',
          email: 'alice@example.com',
          newPassword: 'newPass123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP verification successful');
      expect(body.data.success).toBe(true);

      // Verify the UPDATE query was executed
      const updateCall = pgClientQueryMock.mock.calls.find(call => {
        const [query] = call;
        return (
          typeof query === 'string' && (query as string).includes('UPDATE')
        );
      });
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('UPDATE "users"');
      expect(updateQuery).toContain('"password" = $1');

      await app.close();
    });

    test('should set updated_at when the auth model has an updated_at field', async () => {
      const modelsWithTimestamps: Record<string, ModelConfig> = {
        users: {
          fields: {
            id: {type: 'integer', primaryKey: true},
            email: {type: 'string', nullable: false},
            password: {type: 'string', nullable: false},
            updated_at: {type: 'datetime'},
          },
        },
      };
      const app = await createOtpApp(upAuthConfig, modelsWithTimestamps);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              email: 'alice@example.com',
              password: 'old_hashed',
              updated_at: null,
            },
          ],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue(
        'new_hashed_password' as never,
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password/verify/otp',
        payload: {
          ulid,
          otp: '000000',
          email: 'alice@example.com',
          newPassword: 'newPass123',
        },
      });

      expect(response.statusCode).toBe(200);

      const updateCall = pgClientQueryMock.mock.calls.find(call => {
        const [query] = call;
        return (
          typeof query === 'string' && (query as string).includes('UPDATE')
        );
      });
      expect(updateCall).toBeDefined();
      const updateQuery = (updateCall as [string, unknown[]])[0] as string;
      expect(updateQuery).toContain('UPDATE "users"');
      expect(updateQuery).toContain('"password" = $1');
      expect(updateQuery).toContain('"updated_at" = now()');

      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 401 with invalid OTP', async () => {
      const app = await createOtpApp(upAuthConfig);

      await app.otp.sendOTPForVerification('alice@example.com');
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password/verify/otp',
        payload: {
          ulid: 'wrong-ulid',
          otp: '000000',
          email: 'alice@example.com',
          newPassword: 'newPass123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid or expired OTP');
      await app.close();
    });

    test('should return 400 if newPassword is missing', async () => {
      const app = await createOtpApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password/verify/otp',
        payload: {
          ulid: 'test-ulid',
          otp: '000000',
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        undefined,
        {
          'auth.v1.users.unknown.otpVerifyForgotPassword': {
            variants: ['admin'],
          },
        },
      );
      const sendResponse =
        await app.otp.sendOTPForVerification('admin@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{id: 1, email: 'admin@example.com', password: 'old_hashed'}],
          rowCount: 1,
        }) // SELECT
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue(
        'new_hashed_password' as never,
      );
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/forgot-password/verify/otp',
        payload: {
          ulid,
          otp: '000000',
          email: 'admin@example.com',
          newPassword: 'newPass123',
        },
      });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const app = await createOtpApp(
        upAuthConfig,
        undefined,
        undefined,
        {'auth.admin.users.unknown.otpVerifyForgotPassword': {enabled: false}},
        {
          'auth.v1.users.unknown.otpVerifyForgotPassword': {
            variants: ['admin'],
          },
        },
      );
      const response = await app.inject({
        method: 'POST',
        url: '/admin/auth/forgot-password/verify/otp',
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});
