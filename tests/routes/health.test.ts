import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import dbPlugin from '@/plugin/database';
import rateLimitPlugin from '@/plugin/rate-limit';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import swaggerPlugin from '@/plugin/swagger';

import {resolveConfig} from '@/lib/config/resolve';
import {
  registerErrorHandler,
  registerNotFoundHandler,
} from '@/lib/server/error-handler';

import {registerHealthRoute} from '@/routes/health';

import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

import {
  pgClientQueryMock,
  pgQueryMock,
  sqliteAllMock,
} from '@tests/helpers/db-mocks';

async function createHealthApp(
  overrides: Partial<AppConfigInput> = {},
): Promise<FastifyInstance> {
  const inputConfig: AppConfigInput = {
    application: {
      name: 'Health Test App',
      logLevel: 'error',
      ...overrides.application,
    },
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
      ...overrides.docs,
    },
    infrastructure: {
      database: {
        engine: 'postgres',
        connection: {
          url: 'postgresql://postgres:postgres@localhost:5432/postgres',
        },
      },
      ...overrides.infrastructure,
    },
    data: {models: {}, ...overrides.data},
    authentication: overrides.authentication,
  };

  const resolvedConfig: ResolvedAppConfig = resolveConfig(inputConfig, {
    mode: 'dev',
  });

  const app = Fastify();
  app.appConfig = resolvedConfig;

  registerErrorHandler(app);
  registerNotFoundHandler(app);

  await app.register(dbPlugin);
  await app.register(cachePlugin);
  await app.register(responsePlugin);
  await app.register(sspPlugin);
  await app.register(authPlugin);

  if (resolvedConfig.application.rateLimit.enabled) {
    await app.register(rateLimitPlugin);
  }

  if (resolvedConfig.docs.openapi.enabled) {
    await app.register(swaggerPlugin);
  }

  await app.register(
    async apiApp => {
      apiApp.addHook('preValidation', async request => {
        apiApp.enforceSSP(request);
      });
      registerHealthRoute(apiApp, resolvedConfig);
    },
    {prefix: '/api'},
  );

  await app.ready();
  return app;
}

describe('Healthcheck Route (GET /api/health)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    pgQueryMock.mockReset();
    pgClientQueryMock.mockReset();
    sqliteAllMock.mockReset();

    pgQueryMock.mockResolvedValue({rows: [], rowCount: 0});
    sqliteAllMock.mockReturnValue([]);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Healthy States', () => {
    it('returns 200 OK with Postgres when database and cache are operational', async () => {
      app = await createHealthApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
      expect(body.uptime).toBeUndefined();

      expect(body.services).toBeDefined();
      expect(body.services.database.status).toBe('up');
      expect(typeof body.services.database.latencyMs).toBe('number');
      expect(body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(body.services.cache).toEqual({status: 'up'});
    });

    it('returns 200 OK with SQLite engine when database and cache are operational', async () => {
      app = await createHealthApp({
        infrastructure: {
          database: {
            engine: 'sqlite',
            connection: {url: ':memory:'},
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(typeof body.services.database.latencyMs).toBe('number');
      expect(body.services.cache.status).toBe('up');
    });
  });

  describe('Unhealthy States', () => {
    it('returns 503 Service Unavailable when the database fails the probe', async () => {
      pgQueryMock.mockRejectedValueOnce(new Error('Connection refused'));

      app = await createHealthApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();

      expect(body.status).toBe('degraded');
      expect(body.uptime).toBeUndefined();
      expect(body.services.database).toEqual({
        status: 'down',
        error: 'Connection refused',
      });
      expect(body.services.cache).toEqual({status: 'up'});
    });

    it('returns 503 Service Unavailable when the cache fails the probe', async () => {
      app = await createHealthApp();

      vi.spyOn(app.cache, 'ping').mockRejectedValueOnce(
        new Error('Redis connection timed out'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();

      expect(body.status).toBe('degraded');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache).toEqual({
        status: 'down',
        error: 'Redis connection timed out',
      });
    });

    it('returns 503 Service Unavailable when both database and cache fail', async () => {
      pgQueryMock.mockRejectedValueOnce(new Error('DB is offline'));

      app = await createHealthApp();

      vi.spyOn(app.cache, 'ping').mockRejectedValueOnce(
        new Error('Cache is offline'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();

      expect(body.status).toBe('degraded');
      expect(body.services.database).toEqual({
        status: 'down',
        error: 'DB is offline',
      });
      expect(body.services.cache).toEqual({
        status: 'down',
        error: 'Cache is offline',
      });
    });

    it('handles missing app.db gracefully by reporting database down', async () => {
      app = await createHealthApp();

      // Temporarily simulate uninitialized db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).db = undefined;

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.services.database).toEqual({
        status: 'down',
        error: 'Database service is not initialized',
      });
    });

    it('handles missing app.cache gracefully by reporting cache down', async () => {
      app = await createHealthApp();

      // Temporarily simulate uninitialized cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).cache = undefined;

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.services.cache).toEqual({
        status: 'down',
        error: 'Cache service is not initialized',
      });
    });

    it('falls back to set and delete probe when app.cache has no ping method', async () => {
      app = await createHealthApp();

      // Simulate a custom cache wrapper where ping is not defined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (app.cache as any).ping;
      const setSpy = vi.spyOn(app.cache, 'set');
      const deleteSpy = vi.spyOn(app.cache, 'delete');

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      expect(setSpy).toHaveBeenCalledWith('__healthcheck_probe__', 1, 1);
      expect(deleteSpy).toHaveBeenCalledWith('__healthcheck_probe__');
    });

    it('handles non-Error thrown exceptions properly', async () => {
      pgQueryMock.mockRejectedValueOnce('string error');

      app = await createHealthApp();

      vi.spyOn(app.cache, 'ping').mockRejectedValueOnce('cache string error');

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().services.database).toEqual({
        status: 'down',
        error: 'string error',
      });
      expect(res.json().services.cache).toEqual({
        status: 'down',
        error: 'cache string error',
      });
    });
  });

  describe('Security, Auth & Middleware Bypass', () => {
    it('bypasses up-auth authentication without credentials', async () => {
      app = await createHealthApp({
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'email',
                passwordField: 'password',
              },
              jwtSecret: 'test-secret-1234567890-test-secret',
            },
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('bypasses api-key authentication without x-api-key header', async () => {
      app = await createHealthApp({
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
            config: {key: 'super-secret-key'},
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('bypasses rate limit and does not get throttled', async () => {
      app = await createHealthApp({
        application: {
          rateLimit: {
            enabled: true,
            max: 1,
            timeWindow: '1m',
          },
        },
      });

      const res1 = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });
  });

  describe('OpenAPI Integration', () => {
    it('documents the health check route in OpenAPI schema when enabled', async () => {
      app = await createHealthApp({
        docs: {
          openapi: {
            enabled: true,
            path: '/docs',
            info: {title: 'Health API Docs', version: '1.0.0'},
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(res.statusCode).toBe(200);
      const spec = res.json();

      expect(spec.paths).toBeDefined();
      expect(spec.paths['/api/health']).toBeDefined();
      expect(spec.paths['/api/health'].get).toBeDefined();
      expect(spec.paths['/api/health'].get.tags).toContain('Health');
      expect(spec.paths['/api/health'].get.summary).toBe('Health check');
      expect(spec.paths['/api/health'].get.responses['200']).toBeDefined();
      expect(spec.paths['/api/health'].get.responses['503']).toBeDefined();
    });
  });

  describe('Configurability', () => {
    it('allows custom subpath via application.healthCheck.path', async () => {
      app = await createHealthApp({
        application: {
          healthCheck: {
            enabled: true,
            path: '/status',
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/status',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('normalizes path if prefixed with /api/', async () => {
      app = await createHealthApp({
        application: {
          healthCheck: {
            enabled: true,
            path: '/api/v1/health',
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('normalizes path without leading slash', async () => {
      app = await createHealthApp({
        application: {
          healthCheck: {
            enabled: true,
            path: 'ping',
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/ping',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('normalizes path when given exact /api', async () => {
      app = await createHealthApp({
        application: {
          healthCheck: {
            enabled: true,
            path: '/api',
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('does not register health route when application.healthCheck.enabled is false', async () => {
      app = await createHealthApp({
        application: {
          healthCheck: {
            enabled: false,
            path: '/health',
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
