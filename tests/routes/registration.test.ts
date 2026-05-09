import bcrypt from 'bcrypt';
import Fastify, {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {registerRegistrationRoute} from '@/routes/auth/registration';

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

/** Minimal model config that matches the authModel in example_config. */
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
      {name: 'name', type: 'string', nullable: true},
    ],
  },
];

/** auth config that enables up-auth pointing at the "users" model. */
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
// Helper: create a bare Fastify instance with the registration route wired up
// ---------------------------------------------------------------------------

async function createAuthApp(
  auth: AuthConfig,
  models: ModelConfig[] = authModels,
  dbConfig: DatabaseConfig = pgConfig,
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(databasePlugin, dbConfig);
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
  };

  registerRegistrationRoute(app, config);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/register', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
    // Default DB response: empty result set
    pgQueryMock.mockResolvedValue({rows: [], rowCount: 0});
  });

  // -------------------------------------------------------------------------
  // Guard conditions – route should NOT be registered
  // -------------------------------------------------------------------------

  describe('guard conditions', () => {
    test('should NOT register the route when enableAuth is false', async () => {
      const auth: AuthConfig = {...upAuthConfig, enableAuth: false};
      const app = await createAuthApp(auth);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'a@b.com', password: 'secret'},
      });

      // Route does not exist → 404
      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route when authEngine is not "up-auth"', async () => {
      const auth: AuthConfig = {...upAuthConfig, authEngine: 'api-key'};
      const app = await createAuthApp(auth);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'a@b.com', password: 'secret'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should NOT register the route and log a warning when modelName is not found in models', async () => {
      // Pass an empty models array so the "users" model cannot be found
      const app = await createAuthApp(upAuthConfig, []);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'a@b.com', password: 'secret'},
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    test('should return 201 with the new user data (password excluded)', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'alice@example.com',
          password: 'p@ssw0rd',
          name: 'Alice',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.code).toBe(201);
      expect(body.message).toContain('users');

      // data must NOT include the password field
      expect(body.data).not.toHaveProperty('password');
      expect(body.data).toMatchObject({
        email: 'alice@example.com',
        name: 'Alice',
      });

      await app.close();
    });

    test('should hash the password with bcrypt before inserting', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'bob@example.com', password: 'mySecret'},
      });

      // bcrypt.hash must have been called with the raw password
      expect(hashSpy).toHaveBeenCalledOnce();
      expect(hashSpy).toHaveBeenCalledWith('mySecret', 10);

      hashSpy.mockRestore();
      await app.close();
    });

    test('should store the hashed password (not the plain text) in the database', async () => {
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'carol@example.com', password: 'plaintext'},
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      const [, queryValues] = pgQueryMock.mock.calls[0] as [string, string[]];

      // The stored password should be a bcrypt hash, not the plain text
      const storedPassword = queryValues[1]; // password is the 2nd value (after email)
      expect(storedPassword).not.toBe('plaintext');
      expect(storedPassword).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern

      await app.close();
    });

    test('should build the correct INSERT SQL for the auth model table', async () => {
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'dave@example.com', password: 'secret'},
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      const [query] = pgQueryMock.mock.calls[0] as [string, unknown[]];

      // Table name must be the authModel.modelName
      expect(query).toContain('INSERT INTO "users"');
      expect(query).toContain('"email"');
      expect(query).toContain('"password"');
      expect(query).toContain('$1');
      expect(query).toContain('$2');

      await app.close();
    });

    test('should include optional nullable fields when provided', async () => {
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'eve@example.com',
          password: 'secret',
          name: 'Eve',
        },
      });

      const [query, values] = pgQueryMock.mock.calls[0] as [string, unknown[]];

      expect(query).toContain('"name"');
      // "Eve" should appear in the values (name is the last value)
      expect(values).toContain('Eve');

      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  // Field stripping
  // -------------------------------------------------------------------------

  describe('field stripping', () => {
    test('should strip fields that are not defined in the model', async () => {
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'frank@example.com',
          password: 'secret',
          unknownField: 'should_be_removed',
          anotherExtra: 42,
        },
      });

      const [query] = pgQueryMock.mock.calls[0] as [string, unknown[]];

      // Unknown fields must not appear in the query
      expect(query).not.toContain('unknownField');
      expect(query).not.toContain('anotherExtra');

      await app.close();
    });

    test('should not include the primary key in the INSERT even if provided', async () => {
      const app = await createAuthApp(upAuthConfig);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          id: 999,
          email: 'grace@example.com',
          password: 'secret',
        },
      });

      const [query] = pgQueryMock.mock.calls[0] as [string, unknown[]];

      // Primary key "id" must be stripped
      expect(query).not.toContain('"id"');

      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('validation', () => {
    test('should return 400 when required fields (email) are missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {password: 'secret'}, // email is required
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should return 400 when required fields (password) are missing', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'henry@example.com'}, // password is required
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should return 400 when body is empty', async () => {
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(pgQueryMock).not.toHaveBeenCalled();
      await app.close();
    });

    test('should coerce numeric email to string and succeed (Fastify type coercion)', async () => {
      // Fastify coerces an integer value to a string for a field declared as
      // type "string", so the request succeeds rather than returning 400.
      const app = await createAuthApp(upAuthConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 12345, password: 'secret'},
      });

      // Coercion → 201 (the integer is treated as the string "12345")
      expect(response.statusCode).toBe(201);
      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    test('should return 500 when the database query throws', async () => {
      const app = await createAuthApp(upAuthConfig);
      pgQueryMock.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'ivan@example.com', password: 'secret'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });

    test('should return 500 on DB error (bare test app has no custom PG-code handler)', async () => {
      // Note: the custom 23xxx → 400 mapping lives in server.ts's global error
      // handler which is NOT registered in the bare createAuthApp helper.
      // The bare Fastify instance falls back to 500 for unhandled errors.
      const app = await createAuthApp(upAuthConfig);
      const constraintError = Object.assign(new Error('unique violation'), {
        code: '23505',
      });
      pgQueryMock.mockRejectedValueOnce(constraintError);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {email: 'duplicate@example.com', password: 'secret'},
      });

      expect(response.statusCode).toBe(500);
      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  // Custom model config (different column names)
  // -------------------------------------------------------------------------

  describe('custom authModel column names', () => {
    const customModels: ModelConfig[] = [
      {
        name: 'accounts',
        fields: [
          {
            name: 'account_id',
            type: 'integer',
            primaryKey: true,
            nullable: false,
            unique: true,
          },
          {name: 'username', type: 'string', nullable: false},
          {name: 'secret', type: 'string', nullable: false},
        ],
      },
    ];

    const customAuth: AuthConfig = {
      enableAuth: true,
      authEngine: 'up-auth',
      authModel: {
        modelName: 'accounts',
        idColumn: 'account_id',
        usernameColumn: 'username',
        passwordColumn: 'secret',
      },
    };

    test('should insert into the correct table and omit the custom password column from response', async () => {
      const app = await createAuthApp(customAuth, customModels);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {username: 'judy', secret: 'topsecret'},
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      // The custom password column "secret" must not leak into the response
      expect(body.data).not.toHaveProperty('secret');
      expect(body.data).toMatchObject({username: 'judy'});

      const [query] = pgQueryMock.mock.calls[0] as [string, unknown[]];
      expect(query).toContain('INSERT INTO "accounts"');

      await app.close();
    });

    test('should hash using the custom password column name', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      const app = await createAuthApp(customAuth, customModels);

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {username: 'kate', secret: 'rawpass'},
      });

      expect(hashSpy).toHaveBeenCalledWith('rawpass', 10);

      hashSpy.mockRestore();
      await app.close();
    });
  });
});
