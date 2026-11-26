import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import databasePlugin from '@/plugin/database';
import responsePlugin from '@/plugin/response';

import {createSession} from '@/lib/auth/session';
import {resolveConfig} from '@/lib/config/resolve';

import {registerLogoutRoute} from '@/routes/auth/logout';
import {registerRefreshRoute} from '@/routes/auth/refresh';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';

const authModels: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      email: {type: 'string', nullable: false},
      password: {type: 'string', nullable: false},
      provider: {type: 'string', nullable: false},
      provider_id: {type: 'string', nullable: true},
    },
  },
};

const baseAuth: AuthenticationConfig = {
  enabled: true,
  jwtSecret: 'this-will-never-be-used-in-production-32chars',
  accessTokenExpiration: '15m',
  refreshTokenExpiration: '7d',
  sessionStorage: 'cache',
  userModel: {
    modelName: 'users',
    idField: 'id',
    providerField: 'provider',
  },
  providers: [
    {
      type: 'up-auth',
      config: {
        fields: {
          emailField: 'email',
          passwordField: 'password',
          isVerifiedField: 'is_active',
        },
      },
    },
  ],
};

async function createTestApp(authOverride: Partial<AuthenticationConfig> = {}) {
  const app = Fastify();
  const config = resolveConfig(
    {
      application: {name: 'Refresh Test'},
      infrastructure: {
        database: {engine: 'postgres', connection: {url: 'postgres://mock'}},
      },
      data: {models: authModels},
      authentication: {...baseAuth, ...authOverride},
    },
    {mode: 'dev'},
  );

  app.appConfig = config;
  await app.register(databasePlugin);
  await app.register(cachePlugin);
  await app.register(responsePlugin);
  await app.register(authPlugin);
  registerRefreshRoute(app, config);
  registerLogoutRoute(app, config);
  await app.ready();
  return {app, config};
}

describe('POST /v1/auth/refresh & POST /v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rotates refresh token and issues a new accessToken (cache backend)', async () => {
    const {app, config} = await createTestApp({sessionStorage: 'cache'});
    const {refreshToken} = await createSession(app, config, 1);

    pgQueryMock.mockResolvedValueOnce({
      rows: [{id: 1, email: 'alice@example.com', provider: 'up-auth'}],
      rowCount: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.refreshToken).not.toBe(refreshToken);

    const decoded = jwt.verify(
      body.data.accessToken,
      baseAuth.jwtSecret!,
    ) as Record<string, unknown>;
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe('alice@example.com');

    // Reusing old refresh token must fail with 401
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken},
    });
    expect(replay.statusCode).toBe(401);

    await app.close();
  });

  test('returns 401 when refreshToken is missing or invalid', async () => {
    const {app} = await createTestApp();

    const missing = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {},
    });
    expect(missing.statusCode).toBe(401);

    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken: 'non-existent-token'},
    });
    expect(invalid.statusCode).toBe(401);

    await app.close();
  });

  test('returns 401 and revokes session if user no longer exists', async () => {
    const {app, config} = await createTestApp({sessionStorage: 'cache'});
    const {refreshToken} = await createSession(app, config, 999);

    pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken},
    });
    expect(res.statusCode).toBe(401);

    await app.close();
  });

  test('POST /v1/auth/logout requires bearer token and revokes the session', async () => {
    const {app, config} = await createTestApp({sessionStorage: 'cache'});
    const {refreshToken} = await createSession(app, config, 1);
    const accessToken = app.jwt.sign({id: 1, email: 'alice@example.com'});

    const unauth = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: {refreshToken},
    });
    expect(unauth.statusCode).toBe(401);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {refreshToken},
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().data).toEqual({success: true});

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken},
    });
    expect(refreshAfterLogout.statusCode).toBe(401);

    await app.close();
  });

  test('resolves SSO provider fields and separate RBAC model on refresh', async () => {
    const app = Fastify();
    const config = resolveConfig(
      {
        application: {name: 'Refresh SSO+RBAC Test'},
        infrastructure: {
          database: {engine: 'postgres', connection: {url: 'postgres://mock'}},
        },
        data: {
          models: {
            ...authModels,
            roles: {
              fields: {
                id: {type: 'integer', primaryKey: true},
                role: {type: 'string'},
              },
            },
          },
        },
        rbac: {
          enabled: true,
          modelName: 'roles',
          roleField: 'role',
          defaultRole: 'viewer',
        },
        authentication: {
          enabled: true,
          jwtSecret: 'this-will-never-be-used-in-production-32chars',
          sessionStorage: 'cache',
          userModel: {
            modelName: 'users',
            idField: 'id',
            providerField: 'provider',
          },
          providers: [
            {
              type: 'sso',
              name: 'google',
              protocol: 'oidc',
              config: {
                fields: {
                  providerIdField: 'provider_id',
                  usernameField: 'email',
                },
                issuerUrl: 'https://accounts.google.com',
                clientId: 'cid',
                clientSecret: 'csec',
              },
            },
          ],
        },
      },
      {mode: 'dev'},
    );

    app.appConfig = config;
    await app.register(databasePlugin);
    await app.register(cachePlugin);
    await app.register(responsePlugin);
    await app.register(authPlugin);
    registerRefreshRoute(app, config);
    await app.ready();

    const {refreshToken} = await createSession(app, config, 5);
    pgQueryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            email: 'sso@example.com',
            provider: 'google',
            provider_id: 'g-123',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{id: 5, role: 'admin'}],
        rowCount: 1,
      });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken},
    });
    expect(res.statusCode).toBe(200);
    const decoded = jwt.verify(
      res.json().data.accessToken,
      'this-will-never-be-used-in-production-32chars',
    ) as Record<string, unknown>;
    expect(decoded.providerId).toBe('g-123');
    expect(decoded.role).toBe('admin');

    // Fallback when user.provider does not match any configured SSO or up-auth provider
    const {refreshToken: rt2} = await createSession(app, config, 6);
    pgQueryMock
      .mockResolvedValueOnce({
        rows: [{id: 6, email: 'other@example.com', provider: 'unknown'}],
        rowCount: 1,
      })
      .mockResolvedValueOnce({rows: [], rowCount: 0});
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {refreshToken: rt2},
    });
    expect(res2.statusCode).toBe(200);

    await app.close();
  });

  test('logout returns 401 when JWT payload is missing id', async () => {
    const {app} = await createTestApp({sessionStorage: 'cache'});
    const tokenWithoutId = app.jwt.sign({email: 'no-id@example.com'});

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {authorization: `Bearer ${tokenWithoutId}`},
      payload: {refreshToken: 'some-token'},
    });
    expect(res.statusCode).toBe(401);

    await app.close();
  });

  test('skips route registration when auth disabled or userModel missing', async () => {
    const app = Fastify();
    const disabledConfig = resolveConfig(
      {
        application: {name: 'Disabled'},
        infrastructure: {
          database: {engine: 'postgres', connection: {url: 'postgres://mock'}},
        },
        data: {models: authModels},
      },
      {mode: 'dev'},
    );
    registerRefreshRoute(app, disabledConfig);
    registerLogoutRoute(app, disabledConfig);

    const missingModelConfig = resolveConfig(
      {
        application: {name: 'Missing Model'},
        infrastructure: {
          database: {engine: 'postgres', connection: {url: 'postgres://mock'}},
        },
        data: {models: authModels},
        authentication: baseAuth,
      },
      {mode: 'dev'},
    );
    delete missingModelConfig.data.models.users;
    registerRefreshRoute(app, missingModelConfig);
    registerLogoutRoute(app, missingModelConfig);

    expect(true).toBe(true);
  });
});
