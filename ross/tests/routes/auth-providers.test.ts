import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {resolveConfig} from '@/lib/config/resolve';

import {registerProvidersRoute} from '@/routes/auth/providers';

import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

import {authModels} from '@tests/helpers/auth-config';
import {pgQueryMock} from '@tests/helpers/db-mocks';

const dbConfig = {
  engine: 'postgres' as const,
  connection: {url: 'postgresql://postgres:postgres@localhost:5432/postgres'},
};

const upAuth = {
  type: 'up-auth' as const,
  config: {
    fields: {
      emailField: 'email',
      passwordField: 'password',
      isVerifiedField: 'is_active',
    },
  },
};

const oauth2 = {
  type: 'sso' as const,
  name: 'github',
  protocol: 'oauth2' as const,
  config: {
    fields: {providerIdField: 'provider_id'},
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scopes: ['read:user'],
  },
};

const authenticationWith = (
  providers: unknown[],
  overrides: Record<string, unknown> = {},
) => ({
  enabled: true,
  jwtSecret: 'a-very-long-secret-used-for-testing-purposes',
  userModel: {modelName: 'users', idField: 'id', providerField: 'provider'},
  providers: providers as never,
  ...overrides,
});

async function buildApp(
  authentication: AppConfigInput['authentication'],
  overrides: Partial<AppConfigInput> = {},
): Promise<FastifyInstance> {
  const config: ResolvedAppConfig = resolveConfig(
    {
      application: {name: 'Auth Route Test'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {database: dbConfig},
      data: {models: authModels},
      authentication,
      ...overrides,
    },
    {mode: 'dev'},
  );

  const app = Fastify();
  app.appConfig = config;

  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);

  registerProvidersRoute(app, config);

  await app.ready();

  return app;
}

beforeEach(() => {
  pgQueryMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /auth/providers', () => {
  test('lists every configured provider', async () => {
    const app = await buildApp(authenticationWith([upAuth, oauth2]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      type: 'up-auth',
      login: {method: 'POST', url: '/v1/auth/login'},
    });
    expect(body.data[1]).toMatchObject({
      type: 'sso',
      name: 'github',
      protocol: 'oauth2',
      login: {method: 'GET', url: '/v1/auth/sso/github/login'},
    });

    await app.close();
  });

  test('is not registered when the policy disables it', async () => {
    const app = await buildApp(authenticationWith([upAuth]), {
      apis: {'auth.v1.users.unknown.providers': {enabled: false}},
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('is not registered for api-key only', async () => {
    const app = await buildApp(
      authenticationWith([{type: 'api-key', config: {key: 'k'}}]),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
