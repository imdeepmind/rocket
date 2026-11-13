import Fastify, {FastifyInstance} from 'fastify';
import {describe, expect, it} from 'vitest';

import corsPlugin from '@/plugin/cors';

import {DEFAULT_CORS} from '@/lib/config/resolve';

import {
  ResolvedAppConfig,
  ResolvedApplicationConfig,
  ResolvedCorsConfig,
} from '@/interfaces/config';

function createMockApp(
  corsOverrides?: Partial<ResolvedCorsConfig>,
): FastifyInstance {
  const app = Fastify();

  const defaultCors: ResolvedCorsConfig = {
    enabled: true,
    origins: ['https://app.example.com', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['x-ratelimit-limit'],
    credentials: false,
    maxAge: 86400,
    routes: [],
    ...corsOverrides,
  };

  app.appConfig = {
    application: {
      name: 'Test App',
      logLevel: 'error',
      cors: defaultCors,
    } as ResolvedApplicationConfig,
  } as ResolvedAppConfig;

  app.get('/api/users', async () => ({users: []}));
  app.post('/api/users', async () => ({created: true}));
  app.get('/health', async () => ({status: 'ok'}));

  return app;
}

describe('cors plugin', () => {
  it('should not register cors if cors is not enabled', async () => {
    const app = createMockApp({enabled: false});
    await app.register(corsPlugin);
    await app.ready();

    // Normal request
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://app.example.com'},
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    // Preflight request
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(404);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow allowlisted origin and return proper CORS headers', async () => {
    const app = createMockApp();
    await app.register(corsPlugin);
    await app.ready();

    // Normal request
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://app.example.com'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );

    // Preflight OPTIONS request
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');
    expect(preflight.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
    expect(preflight.headers['access-control-max-age']).toBe('86400');
  });

  it('should deny non-allowlisted origins', async () => {
    const app = createMockApp();
    await app.register(corsPlugin);
    await app.ready();

    // Normal request
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://malicious-site.com'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    // Preflight request
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://malicious-site.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(404);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should reject Origin: null', async () => {
    const app = createMockApp();
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'null'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'null',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(404);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should support wildcard origin when credentials is false', async () => {
    const app = createMockApp({
      origins: ['*'],
      credentials: false,
    });
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://any-domain.com'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://any-domain.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('*');
  });

  it('should still reject Origin: null when origins has wildcard "*"', async () => {
    const app = createMockApp({
      origins: ['*'],
      credentials: false,
    });
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'null'},
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'null',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(404);
  });

  it('should emit Access-Control-Allow-Credentials when credentials is true', async () => {
    const app = createMockApp({
      origins: ['https://app.example.com'],
      credentials: true,
    });
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://app.example.com'},
    });
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should emit Access-Control-Expose-Headers when configured', async () => {
    const app = createMockApp({
      exposedHeaders: ['x-ratelimit-limit', 'x-ratelimit-remaining'],
    });
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://app.example.com'},
    });
    expect(res.headers['access-control-expose-headers']).toBe(
      'x-ratelimit-limit, x-ratelimit-remaining',
    );
  });

  it('should scope CORS to configured routes globs', async () => {
    const app = createMockApp({
      routes: ['/api/*'],
    });
    await app.register(corsPlugin);
    await app.ready();

    // Matching route: /api/users
    const resMatching = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://app.example.com'},
    });
    expect(resMatching.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );

    const preflightMatching = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(preflightMatching.statusCode).toBe(204);
    expect(preflightMatching.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );

    // Matching route with query params: /api/users?sort=name
    const resMatchingWithQuery = await app.inject({
      method: 'GET',
      url: '/api/users?sort=name',
      headers: {origin: 'https://app.example.com'},
    });
    expect(resMatchingWithQuery.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );

    // Non-matching route: /health
    const resNonMatching = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {origin: 'https://app.example.com'},
    });
    expect(
      resNonMatching.headers['access-control-allow-origin'],
    ).toBeUndefined();

    const preflightNonMatching = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(preflightNonMatching.statusCode).toBe(404);
    expect(
      preflightNonMatching.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  it('should handle empty allowedHeaders and exposedHeaders', async () => {
    const app = createMockApp({
      origins: ['https://example.com'],
      allowedHeaders: [],
      exposedHeaders: [],
    });
    await app.register(corsPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {origin: 'https://example.com'},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://example.com',
    );
  });

  it('allows x-api-key header in preflight with framework default allowedHeaders', async () => {
    const app = createMockApp({
      allowedHeaders: [...DEFAULT_CORS.allowedHeaders],
    });
    await app.register(corsPlugin);
    await app.ready();

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/users',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-api-key',
      },
    });

    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-headers']).toContain(
      'x-api-key',
    );
  });
});
