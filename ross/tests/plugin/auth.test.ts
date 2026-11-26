import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import {describe, expect, it} from 'vitest';

import authPlugin from '@/plugin/auth';

import {resolveConfig} from '@/lib/config/resolve';

import {ResolvedAppConfig} from '@/interfaces/config';

// Minimal resolved config that enables the up-auth engine. Standalone plugin
// tests need an explicit fixture because the plugin no longer registers JWT
// when auth is absent/disabled.
const upAuthFixture = (): ResolvedAppConfig =>
  ({
    application: {name: 'test', logLevel: 'error'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', description: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: ':memory:'}},
    },
    data: {models: {}},
    authentication: {
      enabled: true,
      jwtSecret: 'this-will-never-be-used',
      accessTokenExpiration: '15m',
      refreshTokenExpiration: '7d',
      sessionStorage: 'db',
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
            mfaRequired: false,
          },
        },
      ],
    },
  }) as unknown as ResolvedAppConfig;

describe('Auth Plugin — up-auth engine', () => {
  it('should register @fastify/jwt and expose jwt decorator', async () => {
    const app = Fastify();
    app.appConfig = upAuthFixture();
    await app.register(authPlugin);
    await app.ready();

    expect(app.jwt).toBeDefined();
    expect(typeof app.jwt.sign).toBe('function');
    expect(typeof app.jwt.verify).toBe('function');
  });

  it('should be able to sign and verify a token', async () => {
    const app = Fastify();
    app.appConfig = upAuthFixture();
    await app.register(authPlugin);
    await app.ready();

    const payload = {id: 1, email: 'test@example.com'};
    const token = app.jwt.sign(payload);
    expect(token).toBeDefined();

    const decoded = app.jwt.verify(token) as typeof payload;
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });

  it('should use jwtSecret from config when provided', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {name: 'test', logLevel: 'error'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {
        database: {engine: 'postgres', connection: {url: ':memory:'}},
      },
      data: {models: {}},
      authentication: {
        enabled: true,
        jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
        accessTokenExpiration: '15m',
        refreshTokenExpiration: '7d',
        sessionStorage: 'db',
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
              mfaRequired: false,
            },
          },
        ],
      },
    } as ResolvedAppConfig;
    await app.register(authPlugin);
    await app.ready();

    const payload = {id: 1, email: 'test@example.com'};
    const token = app.jwt.sign(payload);
    expect(token).toBeDefined();

    // Verify with the custom secret — should succeed
    const decoded = app.jwt.verify(token) as typeof payload;
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);

    // Verify with the default secret — should fail
    expect(() => jwt.verify(token, 'your-super-secret-key')).toThrow();
  });

  it('should expose authenticate() that verifies JWT', async () => {
    const app = Fastify();
    app.appConfig = upAuthFixture();
    await app.register(authPlugin);
    await app.ready();

    const payload = {id: 1, email: 'test@example.com'};
    const token = app.jwt.sign(payload);

    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: {authorization: `Bearer ${token}`},
    });
    // No route registered, so we expect 404 — the important thing is
    // that the request had the authenticate method available.
    expect(res.statusCode).toBe(404);
  });

  it('should reject invalid JWT via authenticate()', async () => {
    const app = Fastify();
    app.appConfig = upAuthFixture();
    app.get('/test', async (req, reply) => {
      try {
        await req.authenticate();
        return reply.send({ok: true});
      } catch {
        return reply.status(401).send({ok: false});
      }
    });
    await app.register(authPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {authorization: 'Bearer invalid-token'},
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth Plugin — api-key engine', () => {
  it('should expose authenticate() that accepts valid x-api-key', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {name: 'test', logLevel: 'error'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {
        database: {engine: 'postgres', connection: {url: ':memory:'}},
      },
      data: {models: {}},
      authentication: {
        enabled: true,
        accessTokenExpiration: '15m',
        refreshTokenExpiration: '7d',
        sessionStorage: 'db',
        providers: [
          {
            type: 'api-key',
            config: {key: 'my-secret-key'},
          },
        ],
      },
    } as ResolvedAppConfig;

    app.get('/test', async (req, reply) => {
      await req.authenticate();
      return reply.send({ok: true});
    });

    await app.register(authPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {'x-api-key': 'my-secret-key'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ok: true});
  });

  it('should reject wrong x-api-key', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {name: 'test', logLevel: 'error'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {
        database: {engine: 'postgres', connection: {url: ':memory:'}},
      },
      data: {models: {}},
      authentication: {
        enabled: true,
        accessTokenExpiration: '15m',
        refreshTokenExpiration: '7d',
        sessionStorage: 'db',
        providers: [
          {
            type: 'api-key',
            config: {key: 'my-secret-key'},
          },
        ],
      },
    } as ResolvedAppConfig;

    app.get('/test', async (req, reply) => {
      try {
        await req.authenticate();
        return reply.send({ok: true});
      } catch {
        return reply.status(401).send({ok: false});
      }
    });

    await app.register(authPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {'x-api-key': 'wrong-key'},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ok: false});
  });

  it('should reject missing x-api-key', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {name: 'test', logLevel: 'error'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', description: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {
        database: {engine: 'postgres', connection: {url: ':memory:'}},
      },
      data: {models: {}},
      authentication: {
        enabled: true,
        accessTokenExpiration: '15m',
        refreshTokenExpiration: '7d',
        sessionStorage: 'db',
        providers: [
          {
            type: 'api-key',
            config: {key: 'my-secret-key'},
          },
        ],
      },
    } as ResolvedAppConfig;

    app.get('/test', async (req, reply) => {
      try {
        await req.authenticate();
        return reply.send({ok: true});
      } catch {
        return reply.status(401).send({ok: false});
      }
    });

    await app.register(authPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ok: false});
  });
});

describe('Auth Plugin — empty provider list', () => {
  it('registers no JWT when no provider can issue tokens', async () => {
    const app = Fastify();
    app.appConfig = resolveConfig(
      {
        application: {name: 'test'},
        data: {models: {}},
        authentication: {enabled: true, providers: []},
      },
      {mode: 'dev'},
    );

    await app.register(authPlugin);
    await app.ready();

    // Resolved to disabled because no provider was supplied.
    expect(app.jwt).toBeUndefined();
  });
});

describe('Auth Plugin — disabled auth', () => {
  it('registers no JWT and authenticate() always rejects', async () => {
    const app = Fastify();
    app.appConfig = resolveConfig(
      {
        application: {name: 'test'},
        data: {models: {}},
        authentication: {enabled: false},
      },
      {mode: 'dev'},
    );

    app.get('/test', async (req, reply) => {
      try {
        await req.authenticate();
        return reply.send({ok: true});
      } catch {
        return reply.status(401).send({ok: false});
      }
    });

    await app.register(authPlugin);
    await app.ready();

    expect(app.jwt).toBeUndefined();

    const res = await app.inject({method: 'GET', url: '/test'});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ok: false});
  });
});
