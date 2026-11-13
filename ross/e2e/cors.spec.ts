import {
  APIRequestContext,
  expect,
  request as playwrightRequest,
  test,
} from '@playwright/test';

import {AppConfigInput, CorsConfig} from '@/interfaces/config';

import {createE2EServer, E2EServer} from './helpers/server';

function getCorsTestConfig(
  corsConfig?: Partial<CorsConfig>,
  extraAppConfig?: Partial<AppConfigInput['application']>,
): AppConfigInput {
  return {
    application: {
      name: 'Rocket E2E - CORS',
      logLevel: 'warn',
      cors: corsConfig ?? {
        enabled: true,
        origins: ['https://app.example.com', 'http://localhost:5173'],
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Custom-Header'],
        exposedHeaders: ['x-ratelimit-limit', 'x-ratelimit-remaining'],
        credentials: false,
        maxAge: 86400,
        routes: ['/api/v1/**'],
      },
      healthCheck: {
        enabled: true,
        path: '/api/health',
      },
      ...extraAppConfig,
    },
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {url: './e2e/.data/test.db'},
      },
    },
    data: {
      models: {
        users: {
          fields: {
            id: {
              type: 'integer',
              primaryKey: true,
              autoIncrement: true,
              nullable: false,
            },
            email: {
              type: 'string',
              nullable: false,
            },
          },
        },
      },
    },
    apis: {},
  };
}

/**
 * Executes a preflight OPTIONS request using a dedicated client context
 * without default Content-Type headers, matching realistic browser preflight behavior.
 */
async function preflight(
  server: E2EServer,
  url: string,
  headers: Record<string, string>,
) {
  const client: APIRequestContext = await playwrightRequest.newContext({
    baseURL: server.baseURL,
  });
  try {
    return await client.fetch(url, {
      method: 'OPTIONS',
      headers,
    });
  } finally {
    await client.dispose();
  }
}

test.describe('CORS Preflight (OPTIONS Requests)', () => {
  test('Preflight succeeds for allowlisted origin with 204 and correct CORS headers', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      // Primary origin preflight
      const res1 = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Authorization',
      });

      expect(res1.status()).toBe(204);
      expect(res1.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
      expect(res1.headers()['access-control-allow-methods']).toContain('POST');
      expect(res1.headers()['access-control-allow-headers']).toContain(
        'Content-Type',
      );
      expect(res1.headers()['access-control-allow-headers']).toContain(
        'Authorization',
      );
      expect(res1.headers()['access-control-max-age']).toBe('86400');
      expect(res1.headers()['vary']).toMatch(/origin/i);

      // Secondary origin preflight
      const res2 = await preflight(server, '/api/v1/users/', {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      });

      expect(res2.status()).toBe(204);
      expect(res2.headers()['access-control-allow-origin']).toBe(
        'http://localhost:5173',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('Preflight fails with 404 and no CORS headers for unauthorized origin', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://unauthorized-attacker.com',
        'access-control-request-method': 'POST',
      });

      expect(res.status()).toBe(404);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Preflight rejects Origin: null with 404', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'null',
        'access-control-request-method': 'POST',
      });

      expect(res.status()).toBe(404);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Preflight restricts allowed methods to configured methods list', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        methods: ['GET', 'POST'],
      }),
    );

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'DELETE',
      });

      expect(res.status()).toBe(204);
      const allowMethods = res.headers()['access-control-allow-methods'];
      expect(allowMethods).toContain('GET');
      expect(allowMethods).toContain('POST');
      expect(allowMethods).not.toContain('DELETE');
    } finally {
      await server.cleanup();
    }
  });

  test('Preflight restricts allowed headers to configured allowedHeaders list', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        allowedHeaders: ['Authorization', 'Content-Type'],
      }),
    );

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Authorization, X-Disallowed-Header',
      });

      expect(res.status()).toBe(204);
      const allowHeaders = res.headers()['access-control-allow-headers'];
      expect(allowHeaders).toContain('Authorization');
      expect(allowHeaders).toContain('Content-Type');
      expect(allowHeaders).not.toContain('X-Disallowed-Header');
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Actual Requests (GET, POST, PUT, PATCH, DELETE)', () => {
  test('Simple GET request includes Access-Control-Allow-Origin for allowlisted origin', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
      expect(res.headers()['vary']).toMatch(/origin/i);
    } finally {
      await server.cleanup();
    }
  });

  test('Mutating POST request includes Access-Control-Allow-Origin', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.post('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
        data: {
          email: 'alice@example.com',
        },
      });

      expect(res.status()).toBe(201);
      expect(res.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('Actual request from unauthorized origin returns response without CORS headers', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://unauthorized.com',
        },
      });

      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Actual request with Origin: null returns response without CORS headers', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'null',
        },
      });

      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Same-origin / direct request (no Origin header) returns response without CORS headers', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.get('/api/v1/users/');

      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Wildcard Origins (origins: ["*"])', () => {
  test('Wildcard origin allows arbitrary cross-origin requests with "*"', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['*'],
        credentials: false,
      }),
    );

    try {
      // GET request from arbitrary domain
      const getRes = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://any-domain-random.org',
        },
      });

      expect(getRes.status()).toBe(200);
      expect(getRes.headers()['access-control-allow-origin']).toBe('*');

      // Preflight request from different domain
      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'https://another-domain-service.io',
        'access-control-request-method': 'POST',
      });

      expect(preflightRes.status()).toBe(204);
      expect(preflightRes.headers()['access-control-allow-origin']).toBe('*');
    } finally {
      await server.cleanup();
    }
  });

  test('Wildcard origin still rejects Origin: null', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['*'],
        credentials: false,
      }),
    );

    try {
      // GET with Origin: null
      const getRes = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'null',
        },
      });

      expect(getRes.status()).toBe(200);
      expect(getRes.headers()['access-control-allow-origin']).toBeUndefined();

      // Preflight with Origin: null
      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'null',
        'access-control-request-method': 'POST',
      });

      expect(preflightRes.status()).toBe(404);
      expect(
        preflightRes.headers()['access-control-allow-origin'],
      ).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Credentials (credentials: true vs false)', () => {
  test('credentials: true emits Access-Control-Allow-Credentials: true with explicit origin', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        credentials: true,
      }),
    );

    try {
      // GET request
      const getRes = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(getRes.status()).toBe(200);
      expect(getRes.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
      expect(getRes.headers()['access-control-allow-credentials']).toBe('true');

      // Preflight request
      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });

      expect(preflightRes.status()).toBe(204);
      expect(preflightRes.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
      expect(preflightRes.headers()['access-control-allow-credentials']).toBe(
        'true',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('credentials: false omits Access-Control-Allow-Credentials header', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        credentials: false,
      }),
    );

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-credentials']).toBeUndefined();

      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });

      expect(preflightRes.status()).toBe(204);
      expect(
        preflightRes.headers()['access-control-allow-credentials'],
      ).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Exposed Headers (exposedHeaders)', () => {
  test('Emits Access-Control-Expose-Headers with configured header names', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        exposedHeaders: [
          'x-ratelimit-limit',
          'x-ratelimit-remaining',
          'x-custom-meta',
        ],
      }),
    );

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(res.status()).toBe(200);
      const exposed = res.headers()['access-control-expose-headers'];
      expect(exposed).toContain('x-ratelimit-limit');
      expect(exposed).toContain('x-ratelimit-remaining');
      expect(exposed).toContain('x-custom-meta');
    } finally {
      await server.cleanup();
    }
  });

  test('Omits Access-Control-Expose-Headers when exposedHeaders is empty', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        exposedHeaders: [],
      }),
    );

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(res.status()).toBe(200);
      const exposed = res.headers()['access-control-expose-headers'];
      expect(Boolean(exposed)).toBe(false);
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Cache Duration (maxAge)', () => {
  test('Custom maxAge sets Access-Control-Max-Age header on preflight', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        maxAge: 3600,
      }),
    );

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });

      expect(res.status()).toBe(204);
      expect(res.headers()['access-control-max-age']).toBe('3600');
    } finally {
      await server.cleanup();
    }
  });

  test('maxAge: 0 sets Access-Control-Max-Age: 0', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        maxAge: 0,
      }),
    );

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });

      expect(res.status()).toBe(204);
      expect(res.headers()['access-control-max-age']).toBe('0');
    } finally {
      await server.cleanup();
    }
  });

  test('Omitted maxAge defaults to 86400', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        // maxAge omitted intentionally
      }),
    );

    try {
      const res = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });

      expect(res.status()).toBe(204);
      expect(res.headers()['access-control-max-age']).toBe('86400');
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Route Scoping (routes)', () => {
  test('Applies CORS headers only to routes matching configured globs', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        routes: ['/api/v1/**'],
      }),
    );

    try {
      // Matching route: /api/v1/users/
      const matchRes = await server.request.get('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });
      expect(matchRes.status()).toBe(200);
      expect(matchRes.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );

      const matchPreflight = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });
      expect(matchPreflight.status()).toBe(204);
      expect(matchPreflight.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );

      // Non-matching route: /api/health
      const nonMatchRes = await server.request.get('/api/health', {
        headers: {
          origin: 'https://app.example.com',
        },
      });
      expect(nonMatchRes.status()).toBe(200);
      expect(
        nonMatchRes.headers()['access-control-allow-origin'],
      ).toBeUndefined();

      const nonMatchPreflight = await preflight(server, '/api/health', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });
      expect(nonMatchPreflight.status()).toBe(404);
      expect(
        nonMatchPreflight.headers()['access-control-allow-origin'],
      ).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Route scoping strips query parameters and hash fragments before matching', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        routes: ['/api/v1/users*'],
      }),
    );

    try {
      const resWithQuery = await server.request.get(
        '/api/v1/users/?sort=email&limit=10',
        {
          headers: {
            origin: 'https://app.example.com',
          },
        },
      );

      expect(resWithQuery.status()).toBe(200);
      expect(resWithQuery.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('Empty or omitted routes applies CORS globally to all endpoints', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
        routes: [],
      }),
    );

    try {
      // Endpoint 1: /api/v1/users/
      const res1 = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });
      expect(res1.status()).toBe(200);
      expect(res1.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );

      // Endpoint 2: /api/health
      const res2 = await server.request.get('/api/health', {
        headers: {origin: 'https://app.example.com'},
      });
      expect(res2.status()).toBe(200);
      expect(res2.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Error Handling & Feature Interoperability', () => {
  test('CORS headers are preserved on 400 Bad Request validation errors', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      // Missing required 'email' field triggers 400
      const res = await server.request.post('/api/v1/users/', {
        headers: {
          origin: 'https://app.example.com',
        },
        data: {
          nonExistentProperty: 123,
        },
      });

      expect(res.status()).toBe(400);
      expect(res.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('CORS headers are preserved on 404 Not Found for nonexistent sub-routes', async () => {
    const server = await createE2EServer(getCorsTestConfig());

    try {
      const res = await server.request.get('/api/v1/nonexistent-path/', {
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(res.status()).toBe(404);
      expect(res.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('CORS headers and exposedHeaders are preserved on 429 Rate Limit breaches', async () => {
    const server = await createE2EServer(
      getCorsTestConfig(
        {
          enabled: true,
          origins: ['https://app.example.com'],
          exposedHeaders: ['x-ratelimit-limit', 'x-ratelimit-remaining'],
        },
        {
          rateLimit: {
            enabled: true,
            max: 2,
            timeWindow: '5s',
          },
        },
      ),
    );

    try {
      // Consume quota
      await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });
      await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });

      // 3rd hit breaches quota (429)
      const res429 = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });

      expect(res429.status()).toBe(429);
      expect(res429.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );
      const exposed = res429.headers()['access-control-expose-headers'];
      expect(exposed).toContain('x-ratelimit-limit');
      expect(exposed).toContain('x-ratelimit-remaining');
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Defaults and Disabled States', () => {
  test('Explicitly disabled CORS (enabled: false) skips CORS registration', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: false,
        origins: ['https://app.example.com'],
      }),
    );

    try {
      // Normal request
      const res = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });
      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();

      // Preflight request returns 404 since no OPTIONS route is registered
      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
      });
      expect(preflightRes.status()).toBe(404);
      expect(
        preflightRes.headers()['access-control-allow-origin'],
      ).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Omitted CORS block in application config defaults to disabled', async () => {
    const config: AppConfigInput = {
      application: {
        name: 'Rocket E2E - CORS Default Omitted',
        logLevel: 'warn',
        // cors intentionally omitted
      },
      infrastructure: {
        database: {
          engine: 'sqlite',
          connection: {url: './e2e/.data/test.db'},
        },
      },
      data: {
        models: {
          users: {
            fields: {
              id: {
                type: 'integer',
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
              },
              email: {
                type: 'string',
                nullable: false,
              },
            },
          },
        },
      },
      apis: {},
    };

    const server = await createE2EServer(config);

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });
      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBeUndefined();

      const preflightRes = await preflight(server, '/api/v1/users/', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      });
      expect(preflightRes.status()).toBe(404);
      expect(
        preflightRes.headers()['access-control-allow-origin'],
      ).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });

  test('Minimal enabled config applies framework defaults', async () => {
    const server = await createE2EServer(
      getCorsTestConfig({
        enabled: true,
        origins: ['https://app.example.com'],
      }),
    );

    try {
      const res = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://app.example.com'},
      });
      expect(res.status()).toBe(200);
      expect(res.headers()['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );

      const otherRes = await server.request.get('/api/v1/users/', {
        headers: {origin: 'https://example.com'},
      });
      expect(otherRes.status()).toBe(200);
      expect(otherRes.headers()['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('CORS Negative Configuration & Schema Validation', () => {
  test('Startup rejects enabled: true with empty origins', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: [],
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /origins must contain at least one origin when cors is enabled/,
    );
  });

  test('Startup rejects enabled: true with missing origins', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /origins must contain at least one origin when cors is enabled/,
    );
  });

  test('Startup rejects credentials: true combined with wildcard origin "*"', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: ['*'],
      credentials: true,
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /credentials cannot be true when origins includes "\*"/,
    );
  });

  test('Startup rejects invalid HTTP method enum', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: ['https://app.example.com'],
      methods: ['INVALID_METHOD' as unknown as 'GET'],
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /methods.*must be equal to one of the allowed values/,
    );
  });

  test('Startup rejects negative maxAge', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: ['https://app.example.com'],
      maxAge: -1,
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /maxAge.*must be >= 0/,
    );
  });

  test('Startup rejects non-integer maxAge', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: ['https://app.example.com'],
      maxAge: 3.5 as unknown as number,
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /maxAge.*must be integer/,
    );
  });

  test('Startup rejects non-boolean enabled', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: 'true' as unknown as boolean,
      origins: ['https://app.example.com'],
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /enabled.*must be boolean/,
    );
  });

  test('Startup rejects non-boolean credentials', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: ['https://app.example.com'],
      credentials: 'true' as unknown as boolean,
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /credentials.*must be boolean/,
    );
  });

  test('Startup rejects empty string in origins', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: [''],
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /origins.*must NOT have fewer than 1 characters/,
    );
  });

  test('Startup rejects non-string items in origins', async () => {
    const invalidConfig = getCorsTestConfig({
      enabled: true,
      origins: [123 as unknown as string],
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /origins.*must be string/,
    );
  });

  test('Environment variable in origins is correctly resolved', async () => {
    const envVarName = 'E2E_TEST_CORS_ORIGIN';
    const originalEnv = process.env[envVarName];
    process.env[envVarName] = 'https://resolved-env.example.com';

    try {
      const server = await createE2EServer(
        getCorsTestConfig({
          enabled: true,
          origins: [`env:${envVarName}`],
        }),
      );

      try {
        // Resolved origin allowed
        const allowedRes = await server.request.get('/api/v1/users/', {
          headers: {origin: 'https://resolved-env.example.com'},
        });
        expect(allowedRes.status()).toBe(200);
        expect(allowedRes.headers()['access-control-allow-origin']).toBe(
          'https://resolved-env.example.com',
        );

        // Other origin denied
        const deniedRes = await server.request.get('/api/v1/users/', {
          headers: {origin: 'https://other-domain.com'},
        });
        expect(deniedRes.status()).toBe(200);
        expect(
          deniedRes.headers()['access-control-allow-origin'],
        ).toBeUndefined();
      } finally {
        await server.cleanup();
      }
    } finally {
      if (originalEnv !== undefined) {
        process.env[envVarName] = originalEnv;
      } else {
        delete process.env[envVarName];
      }
    }
  });
});
