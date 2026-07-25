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
  registerLoginOtpVerifyRoute,
  registerRegistrationOtpVerifyRoute,
} from '@/routes/auth/otp-verify';

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

  registerLoginOtpVerifyRoute(app, config);
  registerRegistrationOtpVerifyRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/login/verify/otp', () => {
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
      const app = await createOtpApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login/verify/otp',
        payload: {ulid: 'test-ulid', otp: '123456', email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and a JWT on successful OTP verification', async () => {
      const app = await createOtpApp(upAuthConfig);

      const sendResponse =
        await app.otp.sendOTPForVerification('alice@example.com');
      const ulid = typeof sendResponse === 'string' ? sendResponse : '';

      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, email: 'alice@example.com', password: 'hashed_password'},
        ],
        rowCount: 1,
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login/verify/otp',
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
        url: '/auth/login/verify/otp',
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
        url: '/auth/login/verify/otp',
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
        url: '/auth/login/verify/otp',
        payload: {ulid: 'test-ulid'},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});

describe('POST /auth/registration/verify/otp', () => {
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
      const app = await createOtpApp(authentication);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/registration/verify/otp',
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

      // Mock SELECT + UPDATE queries
      pgQueryMock
        .mockResolvedValueOnce({
          rows: [{id: 1, email: 'alice@example.com', is_active: false}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1});

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/registration/verify/otp',
        payload: {ulid, otp: '000000', email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('OTP verification successful');

      // No access token for registration verification
      expect(body.data).toBeNull();

      // Verify the UPDATE query was executed
      const updateCall = pgQueryMock.mock.calls.find(call => {
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
  });

  describe('unhappy path', () => {
    test('should return 401 with invalid OTP', async () => {
      const app = await createOtpApp(upAuthConfig);

      await app.otp.sendOTPForVerification('alice@example.com');
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/registration/verify/otp',
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
        url: '/auth/registration/verify/otp',
        payload: {ulid: 'test-ulid'},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
