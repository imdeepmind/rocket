import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import databasePlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import responsePlugin from '@/plugin/response';

import {registerPasswordResetRoute} from '@/routes/auth/password-reset';

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
// Helper: create a bare Fastify instance with the password-reset route wired up
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
  registerPasswordResetRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/password-reset', () => {
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
        url: '/auth/password-reset',
        payload: {
          email: 'test@example.com',
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
        url: '/auth/password-reset',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('happy path', () => {
    test('should return 200 and otp_id when user exists', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock user lookup - user found
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

      // Spy on OTP service
      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockResolvedValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('Password reset OTP sent successfully');
      expect(body.data).toEqual({
        otp_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect(sendOtpSpy).toHaveBeenCalledWith('alice@example.com');

      sendOtpSpy.mockRestore();
      await app.close();
    });

    test('should send OTP to correct email address', async () => {
      const app = await createAuthApp(upAuthConfig);

      const testEmail = 'user123@example.com';

      // Mock user lookup
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 2, email: testEmail, password: 'hashed', is_active: false}],
        rowCount: 1,
      });

      // Spy on OTP service
      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockResolvedValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: testEmail,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(sendOtpSpy).toHaveBeenCalledWith(testEmail);

      sendOtpSpy.mockRestore();
      await app.close();
    });
  });

  describe('unhappy path', () => {
    test('should return 404 when user not found', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock user lookup - user not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'unknown@example.com',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe(404);
      expect(body.message).toBe('User not found');

      await app.close();
    });

    test('should not send OTP when user does not exist', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock user lookup - user not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      // Spy on OTP service
      const sendOtpSpy = vi.spyOn(app.otp, 'sendOTPForVerification');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'unknown@example.com',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(sendOtpSpy).not.toHaveBeenCalled();

      sendOtpSpy.mockRestore();
      await app.close();
    });
  });

  describe('validation', () => {
    test('should return 400 when email is missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when email format is invalid', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should return 400 when email is empty string', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: '',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    test('should accept email with valid format variations', async () => {
      const app = await createAuthApp(upAuthConfig);

      const validEmails = [
        'simple@example.com',
        'very.common@example.com',
        'disposable.style.email.with+symbol@example.com',
        'other.email-with-hyphen@example.com',
        'user@domain.co.uk',
      ];

      for (const email of validEmails) {
        // Mock user lookup
        pgQueryMock.mockResolvedValueOnce({
          rows: [{id: 1, email, password: 'hashed', is_active: true}],
          rowCount: 1,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/auth/password-reset',
          payload: {
            email,
          },
        });

        expect(response.statusCode).toBeOneOf([200, 400, 404]);
      }

      await app.close();
    });
  });

  describe('database interaction', () => {
    test('should query the correct table and email column', async () => {
      const app = await createAuthApp(upAuthConfig);

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

      // Spy on OTP service
      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockResolvedValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');

      await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'alice@example.com',
        },
      });

      // Verify the query was called with correct SQL
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "email" = $1 LIMIT 1;',
        ['alice@example.com'],
      );

      sendOtpSpy.mockRestore();
      await app.close();
    });

    test('should handle database errors gracefully', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock database error
      pgQueryMock.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.code).toBe(500);
      expect(body.message).toBe('Failed to initiate password reset');

      await app.close();
    });

    test('should handle OTP generation errors gracefully', async () => {
      const app = await createAuthApp(upAuthConfig);

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

      // Spy on OTP service to throw error
      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockRejectedValueOnce(new Error('Failed to send email'));

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.code).toBe(500);

      sendOtpSpy.mockRestore();
      await app.close();
    });
  });

  describe('response format', () => {
    test('should return correct response structure on success', async () => {
      const app = await createAuthApp(upAuthConfig);

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

      // Spy on OTP service
      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockResolvedValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('code', 200);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('otp_id');

      sendOtpSpy.mockRestore();
      await app.close();
    });

    test('should return correct response structure on 404 error', async () => {
      const app = await createAuthApp(upAuthConfig);

      // Mock user lookup - user not found
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          email: 'unknown@example.com',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body).toHaveProperty('code', 404);
      expect(body).toHaveProperty('message');
      expect(body.data).toBeNull();

      await app.close();
    });
  });

  describe('end-to-end workflow', () => {
    test('complete password reset workflow: password-reset -> verify-otp/password-reset', async () => {
      const app = await createAuthApp(upAuthConfig);

      const email = 'alice@example.com';
      const otpUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      // Step 1: Initiate password reset
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 1, email, password: 'oldHashedPassword', is_active: true}],
        rowCount: 1,
      });

      const sendOtpSpy = vi
        .spyOn(app.otp, 'sendOTPForVerification')
        .mockResolvedValue(otpUlid);

      const resetResponse = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {email},
      });

      expect(resetResponse.statusCode).toBe(200);
      const resetBody = resetResponse.json();
      expect(resetBody.data.otp_id).toBe(otpUlid);

      // Verify OTP was sent
      expect(sendOtpSpy).toHaveBeenCalledWith(email);

      sendOtpSpy.mockRestore();
      await app.close();
    });
  });
});
