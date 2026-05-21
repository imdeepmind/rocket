import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test} from 'vitest';

import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerResendOtpRoute} from '@/routes/auth/resend-otp';

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
// Helper: create a bare Fastify instance with the resend route wired up
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
  registerResendOtpRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/resend-otp', () => {
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
        url: '/auth/resend-otp',
        payload: {email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    test('should NOT register the route when authEngine is not "up-auth"', async () => {
      const auth: AuthConfig = {...upAuthConfig, authEngine: 'api-key'};
      const app = await createAuthApp(auth);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/resend-otp',
        payload: {email: 'test@example.com'},
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and a new otp_id when resending is successful', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/resend-otp',
        payload: {email: 'alice@example.com'},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('OTP resent successfully');
      expect(body.data.otp_id).toBeDefined();
      expect(typeof body.data.otp_id).toBe('string');

      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when email is missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/resend-otp',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when email format is invalid', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/resend-otp',
        payload: {email: 'not-an-email'},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});
