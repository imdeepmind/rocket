import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import jwt from 'jsonwebtoken';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerLoginRoute} from '@/routes/auth/login';

import {AuthConfig, DatabaseConfig, ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const authModels: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
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
// Helper: create a bare Fastify instance with the login route wired up
// ---------------------------------------------------------------------------

async function createAuthApp(
  auth: AuthConfig,
  models: ModelConfig[] = authModels,
  dbConfig: DatabaseConfig = pgConfig,
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(databasePlugin, dbConfig);
  await app.register(responsePlugin);
  registerLoginRoute(app, models, auth);
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
    test('should NOT register the route when enableAuth is false', async () => {
      const auth: AuthConfig = {...upAuthConfig, enableAuth: false};
      const app = await createAuthApp(auth);

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
      expect(body.data.access_token).toBeDefined();

      // Verify JWT payload
      const secret = 'super-secret-key';
      const decoded = jwt.verify(body.data.access_token, secret) as Record<
        string,
        unknown
      >;
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('alice@example.com');

      expect(compareSpy).toHaveBeenCalledWith('p@ssw0rd', 'hashed_password');
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
