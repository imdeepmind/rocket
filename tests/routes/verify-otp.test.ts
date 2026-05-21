import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerVerifyOtpRoute} from '@/routes/auth/verify-otp';

import {
  AppConfig,
  AuthConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const authModels: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        unique: true,
        nullable: false,
      },
      {name: 'email', type: 'string', nullable: false},
      {name: 'password', type: 'string', nullable: false},
      {name: 'is_active', type: 'boolean', nullable: false, default: false},
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
    isVerifiedColumn: 'is_active',
  },
};

const pgConfig: DatabaseConfig = {
  engine: 'pg',
  connection: {
    urlOrPath: 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
};

// ---------------------------------------------------------------------------
// Helper: create a bare Fastify instance with the verify route wired up
// ---------------------------------------------------------------------------

async function createAuthApp(
  auth: AuthConfig,
  models: ModelConfig[] = authModels,
  dbConfig: DatabaseConfig = pgConfig,
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(databasePlugin, dbConfig);
  await app.register(cachePlugin);
  await app.register(responsePlugin);

  const config: AppConfig = {
    application: {logLevel: 'error'},
    swagger: {
      enabled: false,
      basePath: '/docs',
      info: {title: 'Test', description: 'Test', version: '1.0.0'},
    },
    database: dbConfig,
    models,
    auth,
    communicate: {
      email: {
        emailEngine: 'dummy',
      },
    },
  };

  app.appConfig = config;
  await app.register(authPlugin);
  await app.register(communicatePlugin);
  await app.register(otpPlugin);
  registerVerifyOtpRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/verify-otp/:operation', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
    pgQueryMock.mockResolvedValue({rows: [], rowCount: 0});
  });

  describe('guard conditions', () => {
    test('should NOT register the route when enableAuth is false', async () => {
      const auth: AuthConfig = {...upAuthConfig, enableAuth: false};
      const app = await createAuthApp(auth);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'test@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when authEngine is not "up-auth"', async () => {
      const auth: AuthConfig = {...upAuthConfig, authEngine: 'api-key'};
      const app = await createAuthApp(auth);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'test@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('registration operation', () => {
    test('should return 200 and set isActive to true when OTP verification succeeds', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup and update
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'alice@example.com',
            password: 'hashed',
            is_active: false,
          },
        ],
        rowCount: 1,
      });
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 1});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('OTP verified successfully');
      expect(body.data).toEqual({verified: true});

      expect(verifySpy).toHaveBeenCalledWith(
        'alice@example.com',
        '123456',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      );

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 401 when OTP verification fails', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock failed OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'alice@example.com',
          otp: '111111',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.code).toBe(401);
      expect(body.message).toBe('Invalid or expired OTP');
      expect(body.data).toEqual({verified: false});

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 404 when user not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup - not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'unknown@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe(404);

      verifySpy.mockRestore();
      await app.close();
    });
  });

  describe('mfa operation', () => {
    test('should return 200 with access token when OTP verification succeeds', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'alice@example.com',
            password: 'hashed',
            is_active: true,
          },
        ],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/mfa',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('OTP verified successfully');
      expect(body.data.verified).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(typeof body.data.accessToken).toBe('string');

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 401 when OTP verification fails', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock failed OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/mfa',
        payload: {
          email: 'alice@example.com',
          otp: '111111',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(401);

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 404 when user not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup - not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/mfa',
        payload: {
          email: 'unknown@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(404);

      verifySpy.mockRestore();
      await app.close();
    });
  });

  describe('password-reset operation', () => {
    test('should return 200 and update password when OTP verification succeeds', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'alice@example.com',
            password: 'hashed',
            is_active: true,
          },
        ],
        rowCount: 1,
      });
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 1});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/password-reset',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          password: 'newPassword123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('Password reset successfully');
      expect(body.data).toEqual({verified: true});

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 400 when password is missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'alice@example.com',
            password: 'hashed',
            is_active: true,
          },
        ],
        rowCount: 1,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/password-reset',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          // missing password
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe(400);

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 401 when OTP verification fails', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock failed OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/password-reset',
        payload: {
          email: 'alice@example.com',
          otp: '111111',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          password: 'newPassword123',
        },
      });

      expect(response.statusCode).toBe(401);

      verifySpy.mockRestore();
      await app.close();
    });

    test('should return 404 when user not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock successful OTP verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      // Mock user lookup - not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/password-reset',
        payload: {
          email: 'unknown@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          password: 'newPassword123',
        },
      });

      expect(response.statusCode).toBe(404);

      verifySpy.mockRestore();
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when required fields are missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          // missing ulid
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when email format is invalid', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'invalid-email',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when otp format is invalid (not 6 digits)', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/registration',
        payload: {
          email: 'alice@example.com',
          otp: '12345', // 5 digits
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when invalid operation is provided', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp/invalid-operation',
        payload: {
          email: 'alice@example.com',
          otp: '123456',
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
