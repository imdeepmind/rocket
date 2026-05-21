import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

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
  await app.register(communicatePlugin);
  await app.register(otpPlugin);
  registerVerifyOtpRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/verify-otp', () => {
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
        url: '/auth/verify-otp',
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
        url: '/auth/verify-otp',
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

  describe('happy path', () => {
    test('should return 200 and verified: true when OTP verification succeeds', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Spy on the verify method to mock successful verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp',
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
  });

  describe('unhappy path', () => {
    test('should return 401 and verified: false when OTP verification fails', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Spy on the verify method to mock failed verification
      const verifySpy = vi.spyOn(app.otp, 'verify').mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp',
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

      expect(verifySpy).toHaveBeenCalledWith(
        'alice@example.com',
        '111111',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      );

      verifySpy.mockRestore();
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when required fields are missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-otp',
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
        url: '/auth/verify-otp',
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
        url: '/auth/verify-otp',
        payload: {
          email: 'alice@example.com',
          otp: '12345', // 5 digits
          ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
