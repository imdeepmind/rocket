import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {resolveConfig} from '@/lib/config/resolve';

import {registerSsoRoutes} from '@/routes/auth/sso';

import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

import {authModels} from '@tests/helpers/auth-config';
import {pgQueryMock} from '@tests/helpers/db-mocks';

const mocks = vi.hoisted(() => ({
  getAuthorizeUrlAsync: vi.fn(),
  validatePostResponseAsync: vi.fn(),
  generateServiceProviderMetadata: vi.fn(),
}));

vi.mock('@node-saml/node-saml', () => {
  class SAML {
    getAuthorizeUrlAsync = mocks.getAuthorizeUrlAsync;
    validatePostResponseAsync = mocks.validatePostResponseAsync;

    constructor(options: Record<string, unknown>) {
      void options;
    }
  }

  return {
    SAML,
    ValidateInResponseTo: {always: 'always'},
    generateServiceProviderMetadata: mocks.generateServiceProviderMetadata,
  };
});

const dbConfig = {
  engine: 'postgres' as const,
  connection: {url: 'postgresql://postgres:postgres@localhost:5432/postgres'},
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

const saml = {
  type: 'sso' as const,
  name: 'corp',
  protocol: 'saml' as const,
  config: {
    fields: {providerIdField: 'provider_id'},
    entryPoint: 'https://idp.example.com/saml',
    issuer: 'ross',
    cert: 'certificate',
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
): Promise<FastifyInstance> {
  const config: ResolvedAppConfig = resolveConfig(
    {
      application: {name: 'SSO Route Test'},
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
    },
    {mode: 'dev'},
  );

  const app = Fastify();
  app.appConfig = config;

  await app.register(databasePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);

  registerSsoRoutes(app, config);

  await app.ready();

  return app;
}

const cookieOf = (response: {headers: Record<string, unknown>}): string => {
  const raw = response.headers['set-cookie'];

  if (Array.isArray(raw)) {
    return raw[0];
  }

  return String(raw);
};

const startLogin = async (app: FastifyInstance, name: string) => {
  const response = await app.inject({
    method: 'GET',
    url: `/v1/auth/sso/${name}/login`,
  });
  const setCookie = cookieOf(response as never);
  const cookie = setCookie.split(';')[0];
  const state = new URL(response.headers.location as string).searchParams.get(
    'state',
  ) as string;

  return {response, cookie, state};
};

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
});

beforeEach(() => {
  pgQueryMock.mockReset();
  pgQueryMock.mockResolvedValue({changes: 0, rows: [], rowCount: 0});
  mocks.getAuthorizeUrlAsync.mockReset();
  mocks.validatePostResponseAsync.mockReset();
  mocks.generateServiceProviderMetadata.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GET /auth/sso/:name/login', () => {
  test('sets a hardened state cookie and redirects to the IdP', async () => {
    const app = await buildApp(authenticationWith([oauth2]));

    const {response, cookie, state} = await startLogin(app, 'github');
    const location = new URL(response.headers.location as string);

    expect(response.statusCode).toBe(302);
    expect(cookie.startsWith('__Host-ross_sso_github=')).toBe(true);
    expect(location.searchParams.get('state')).toBe(state);
    expect(location.searchParams.get('redirect_uri')).toContain(
      '/v1/auth/sso/github/callback',
    );

    await app.close();
  });

  test('returns 500 when no secret is configured', async () => {
    const authentication = authenticationWith([oauth2]);
    delete (authentication as {jwtSecret?: string}).jwtSecret;

    const app = await buildApp(authentication);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/login',
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  test('redirects through the SAML adapter', async () => {
    mocks.getAuthorizeUrlAsync.mockResolvedValue('https://idp.example.com/sso');

    const app = await buildApp(authenticationWith([saml]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/corp/login',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://idp.example.com/sso');

    await app.close();
  });
});

describe('GET /auth/sso/:name/callback', () => {
  test('rejects a callback without a state cookie', async () => {
    const app = await buildApp(authenticationWith([oauth2]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/callback?code=abc&state=abc',
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  test('rejects a tampered state cookie', async () => {
    const app = await buildApp(authenticationWith([oauth2]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/callback?code=abc&state=abc',
      headers: {cookie: '__Host-ross_sso_github=tampered'},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  test('rejects a mismatched state parameter', async () => {
    const app = await buildApp(authenticationWith([oauth2]));
    const {cookie} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/callback?code=abc&state=other',
      headers: {cookie},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  test('issues an access token in JSON mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7, login: 'octocat'})),
    );

    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 1, provider: 'github', provider_id: '7'}],
      rowCount: 1,
    });

    const app = await buildApp(authenticationWith([oauth2]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toBeDefined();

    await app.close();
  });

  test('issues an access token with usernameField and providerId when configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(
          jsonResponse({id: 7, email: 'octocat@github.com'}),
        ),
    );

    pgQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          provider: 'github',
          provider_id: '7',
          email: 'octocat@github.com',
        },
      ],
      rowCount: 1,
    });

    const oauth2WithUsername = {
      ...oauth2,
      config: {
        ...oauth2.config,
        fields: {providerIdField: 'provider_id', usernameField: 'email'},
      },
    };

    const app = await buildApp(authenticationWith([oauth2WithUsername]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(200);
    const token = response.json().data.accessToken;
    expect(token).toBeDefined();

    const decoded = app.jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBe(1);
    expect(decoded.providerId).toBe('7');
    expect(decoded.email).toBe('octocat@github.com');

    await app.close();
  });

  test('issues an access token with null email when usernameField is configured but IdP returns no username', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7})),
    );

    pgQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          provider: 'github',
          provider_id: '7',
        },
      ],
      rowCount: 1,
    });

    const oauth2WithUsername = {
      ...oauth2,
      config: {
        ...oauth2.config,
        fields: {providerIdField: 'provider_id', usernameField: 'email'},
      },
    };

    const app = await buildApp(authenticationWith([oauth2WithUsername]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(200);
    const token = response.json().data.accessToken;
    expect(token).toBeDefined();

    const decoded = app.jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBe(1);
    expect(decoded.providerId).toBe('7');
    expect(decoded.email).toBeNull();

    await app.close();
  });

  test('fails with account_already_exists when username/email is already taken', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(
          jsonResponse({id: 7, email: 'taken@example.com'}),
        ),
    );

    // 1. Identity lookup returns empty
    pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});
    // 2. Collision pre-check by username returns existing user
    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 99, email: 'taken@example.com'}],
      rowCount: 1,
    });

    const oauth2WithUsername = {
      ...oauth2,
      config: {
        ...oauth2.config,
        fields: {providerIdField: 'provider_id', usernameField: 'email'},
      },
    };

    const app = await buildApp(authenticationWith([oauth2WithUsername]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain(
      'An account with this email/username already exists',
    );

    await app.close();
  });

  test('redirects with a one-time code when redirectUrl is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7})),
    );

    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 1, provider: 'github', provider_id: '7'}],
      rowCount: 1,
    });

    const app = await buildApp(
      authenticationWith([
        {
          ...oauth2,
          config: {
            ...oauth2.config,
            redirectUrl: 'https://app.example.com/done',
          },
        },
      ]),
    );

    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(302);

    const location = new URL(response.headers.location as string);
    expect(location.origin + location.pathname).toBe(
      'https://app.example.com/done',
    );
    expect(location.searchParams.get('code')).toBeTruthy();

    await app.close();
  });

  test('redirects to failureRedirectUrl on provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)));

    const app = await buildApp(
      authenticationWith([
        {
          ...oauth2,
          config: {
            ...oauth2.config,
            redirectUrl: 'https://app.example.com/done',
            failureRedirectUrl: 'https://app.example.com/error',
          },
        },
      ]),
    );

    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      'https://app.example.com/error?error=provider_error',
    );

    await app.close();
  });

  test('preserves IdP error and error_description on failure redirect', async () => {
    const app = await buildApp(
      authenticationWith([
        {
          ...oauth2,
          config: {
            ...oauth2.config,
            redirectUrl: 'https://app.example.com/done',
            failureRedirectUrl: 'https://app.example.com/error',
          },
        },
      ]),
    );

    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?error=access_denied&error_description=User+denied+access&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('error=access_denied');
    expect(response.headers.location).toContain(
      'error_description=User+denied+access',
    );

    await app.close();
  });

  test('returns 400 with IdP error description when redirectUrl is not set', async () => {
    const app = await buildApp(authenticationWith([oauth2]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?error=access_denied&error_description=User+denied&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe(
      'SSO authentication failed: User denied',
    );

    await app.close();
  });

  test('reports a user resolution failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7})),
    );

    pgQueryMock.mockRejectedValueOnce(new Error('db down'));

    const app = await buildApp(authenticationWith([oauth2]));
    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  test('accepts a SAML assertion via POST', async () => {
    mocks.validatePostResponseAsync.mockResolvedValue({
      profile: {nameID: 'user-1'},
      loggedOut: false,
    });

    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 1, provider: 'corp', provider_id: 'user-1'}],
      rowCount: 1,
    });

    const app = await buildApp(authenticationWith([saml]));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/corp/callback',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      payload: 'SAMLResponse=response&RelayState=relay',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toBeDefined();

    await app.close();
  });
});

describe('POST /auth/sso/:name/token', () => {
  const withRedirect = () =>
    authenticationWith([
      {
        ...oauth2,
        config: {
          ...oauth2.config,
          redirectUrl: 'https://app.example.com/done',
        },
      },
    ]);

  test('exchanges a one-time code for an access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7})),
    );

    pgQueryMock
      .mockResolvedValueOnce({
        rows: [{id: 1, provider: 'github', provider_id: '7'}],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{id: 1, provider: 'github', provider_id: '7'}],
        rowCount: 1,
      });

    const app = await buildApp(withRedirect());
    const {cookie, state} = await startLogin(app, 'github');

    const callback = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });
    const code = new URL(callback.headers.location as string).searchParams.get(
      'code',
    ) as string;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/github/token',
      payload: {code},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toBeDefined();

    const replayResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/github/token',
      payload: {code},
    });

    expect(replayResponse.statusCode).toBe(401);
    expect(replayResponse.json().message).toBe('Invalid or expired code');

    await app.close();
  });

  test('requires a code', async () => {
    const app = await buildApp(withRedirect());

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/github/token',
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  test('rejects an invalid code', async () => {
    const app = await buildApp(withRedirect());

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/github/token',
      payload: {code: 'invalid'},
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  test('rejects a code whose subject no longer exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({id: 7})),
    );

    pgQueryMock
      .mockResolvedValueOnce({
        rows: [{id: 1, provider: 'github', provider_id: '7'}],
        rowCount: 1,
      })
      .mockResolvedValueOnce({rows: [], rowCount: 0});

    const app = await buildApp(withRedirect());
    const {cookie, state} = await startLogin(app, 'github');

    const callback = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });
    const code = new URL(callback.headers.location as string).searchParams.get(
      'code',
    ) as string;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/github/token',
      payload: {code},
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });
});

describe('GET /auth/sso/:name/metadata', () => {
  test('returns SAML service provider metadata', async () => {
    mocks.generateServiceProviderMetadata.mockReturnValue('<xml/>');

    const app = await buildApp(authenticationWith([saml]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/corp/metadata',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.body).toBe('<xml/>');

    await app.close();
  });
});

describe('registerSsoRoutes guards', () => {
  test('registers nothing when auth is disabled', async () => {
    const app = await buildApp({enabled: false});

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/login',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('registers nothing without an SSO provider', async () => {
    const app = await buildApp(
      authenticationWith([
        {
          type: 'up-auth',
          config: {fields: {usernameField: 'email', passwordField: 'password'}},
        },
      ]),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/github/login',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('registers nothing for api-key only', async () => {
    const app = await buildApp(
      authenticationWith([{type: 'api-key', config: {key: 'k'}}]),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/corp/metadata',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('skips an operation disabled by its API policy', async () => {
    const config: ResolvedAppConfig = resolveConfig(
      {
        application: {name: 'SSO Route Test'},
        docs: {
          openapi: {
            enabled: false,
            path: '/docs',
            info: {title: 'Test', description: 'Test', version: '1.0.0'},
          },
        },
        infrastructure: {database: dbConfig},
        data: {models: authModels},
        authentication: authenticationWith([saml]),
        apis: {'auth.v1.users.unknown.ssoMetadata': {enabled: false}},
      },
      {mode: 'dev'},
    );

    const app = Fastify();
    app.appConfig = config;
    await app.register(databasePlugin);
    await app.register(responsePlugin);
    await app.register(authPlugin);
    registerSsoRoutes(app, config);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/corp/metadata',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('returns 404 when the adapter cannot build metadata', async () => {
    mocks.generateServiceProviderMetadata.mockReturnValue('');

    const app = await buildApp(authenticationWith([saml]));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/sso/corp/metadata',
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  test('returns 500 on a callback when no secret is configured', async () => {
    const app = await buildApp(authenticationWith([oauth2]));
    const {cookie, state} = await startLogin(app, 'github');

    const config = app.appConfig as ResolvedAppConfig;
    const withoutSecret: ResolvedAppConfig = {
      ...config,
      authentication: {...config.authentication, jwtSecret: undefined},
    } as ResolvedAppConfig;

    const bare = Fastify();
    bare.appConfig = withoutSecret;
    await bare.register(databasePlugin);
    await bare.register(responsePlugin);
    await bare.register(authPlugin);
    registerSsoRoutes(bare, withoutSecret);
    await bare.ready();

    const response = await bare.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(500);

    await app.close();
    await bare.close();
  });
});

describe('SSO failure and SAML edge cases', () => {
  test('redirects to the success URL when no failure URL is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)));

    const app = await buildApp(
      authenticationWith([
        {
          ...oauth2,
          config: {
            ...oauth2.config,
            redirectUrl: 'https://app.example.com/done',
          },
        },
      ]),
    );

    const {cookie, state} = await startLogin(app, 'github');

    const response = await app.inject({
      method: 'GET',
      url: `/v1/auth/sso/github/callback?code=abc&state=${state}`,
      headers: {cookie},
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      'https://app.example.com/done?error=provider_error',
    );

    await app.close();
  });

  test('accepts a SAML assertion without RelayState', async () => {
    mocks.validatePostResponseAsync.mockResolvedValue({
      profile: {nameID: 'user-1'},
      loggedOut: false,
    });

    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 1, provider: 'corp', provider_id: 'user-1'}],
      rowCount: 1,
    });

    const app = await buildApp(authenticationWith([saml]));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso/corp/callback',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      payload: 'SAMLResponse=response',
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
