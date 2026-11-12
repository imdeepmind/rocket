import {expect, test} from '@playwright/test';

import {
  AppConfigInput,
  CacheDbConfig,
  RateLimitConfig,
} from '@/interfaces/config';

import {DEFAULT_TEST_REDIS_URL} from './helpers/constants';
import {createE2EServer} from './helpers/server';

function getRateLimitConfig(
  cacheConfig?: CacheDbConfig,
  rateLimitConfig?: Partial<RateLimitConfig>,
): AppConfigInput {
  return {
    application: {
      name: 'Rocket E2E - Rate Limit',
      logLevel: 'warn',
      rateLimit: rateLimitConfig ?? {
        enabled: true,
        max: 3,
        timeWindow: '5s',
      },
      healthCheck: {
        enabled: true,
        path: '/health',
      },
    },
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {url: './e2e/.data/test.db'},
      },
      cache: cacheConfig,
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

const cacheEngines: Array<{
  name: string;
  cacheConfig: CacheDbConfig;
}> = [
  {
    name: 'In-Memory Cache',
    cacheConfig: {
      engine: 'memory',
    },
  },
  {
    name: 'Redis Cache',
    cacheConfig: {
      engine: 'redis',
      connection: {
        url: DEFAULT_TEST_REDIS_URL,
      },
    },
  },
];

for (const {name, cacheConfig} of cacheEngines) {
  test.describe(`Rate Limiting (${name})`, () => {
    test.describe.configure({mode: 'serial'});

    test('Header progression and 429 quota breach', async () => {
      const server = await createE2EServer(getRateLimitConfig(cacheConfig));

      try {
        await server.app.cache.clear();

        // Hit 1
        const res1 = await server.request.get('/api/v1/users/');
        expect(res1.status()).toBe(200);
        expect(res1.headers()['x-ratelimit-limit']).toBe('3');
        expect(res1.headers()['x-ratelimit-remaining']).toBe('2');
        expect(Number(res1.headers()['x-ratelimit-reset'])).toBeGreaterThan(0);

        // Hit 2
        const res2 = await server.request.get('/api/v1/users/');
        expect(res2.status()).toBe(200);
        expect(res2.headers()['x-ratelimit-limit']).toBe('3');
        expect(res2.headers()['x-ratelimit-remaining']).toBe('1');

        // Hit 3
        const res3 = await server.request.get('/api/v1/users/');
        expect(res3.status()).toBe(200);
        expect(res3.headers()['x-ratelimit-limit']).toBe('3');
        expect(res3.headers()['x-ratelimit-remaining']).toBe('0');

        // Hit 4: Exceeded quota
        const res4 = await server.request.get('/api/v1/users/');
        expect(res4.status()).toBe(429);
        expect(res4.headers()['x-ratelimit-limit']).toBe('3');
        expect(res4.headers()['x-ratelimit-remaining']).toBe('0');
        expect(res4.headers()['retry-after']).toBeDefined();
        expect(Number(res4.headers()['retry-after'])).toBeGreaterThan(0);

        const body = await res4.json();
        expect(body).toEqual({
          code: 429,
          message: expect.stringMatching(/rate limit exceeded/i),
          data: null,
        });

        // Hit 5 & 6: Repeated breach continuously returns 429 with zero remaining
        for (let i = 5; i <= 6; i++) {
          const res = await server.request.get('/api/v1/users/');
          expect(res.status()).toBe(429);
          expect(res.headers()['x-ratelimit-remaining']).toBe('0');
          expect(res.headers()['retry-after']).toBeDefined();
        }
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });

    test('Malformed payload requests (400) consume quota and trigger 429', async () => {
      const server = await createE2EServer(getRateLimitConfig(cacheConfig));

      try {
        await server.app.cache.clear();

        // Send 3 invalid POST requests (missing required email field)
        for (let i = 0; i < 3; i++) {
          const res = await server.request.post('/api/v1/users/', {
            data: {invalidProperty: 123},
          });
          expect(res.status()).toBe(400);
        }

        // 4th request gets blocked with 429 before reaching request handler
        const res4 = await server.request.post('/api/v1/users/', {
          data: {invalidProperty: 123},
        });
        expect(res4.status()).toBe(429);
        const body = await res4.json();
        expect(body).toEqual({
          code: 429,
          message: expect.stringMatching(/rate limit exceeded/i),
          data: null,
        });
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });

    test('Window expiration automatically resets rate limit counter', async () => {
      const server = await createE2EServer(getRateLimitConfig(cacheConfig));

      try {
        await server.app.cache.clear();

        // Consume all 3 allowed requests
        for (let i = 0; i < 3; i++) {
          const res = await server.request.get('/api/v1/users/');
          expect(res.status()).toBe(200);
        }

        // Verify limit is exhausted
        const blockedRes = await server.request.get('/api/v1/users/');
        expect(blockedRes.status()).toBe(429);

        // Wait for the 5-second window to expire
        await new Promise(resolve => setTimeout(resolve, 5200));

        // Request after window reset should succeed with counter reset
        const resetRes = await server.request.get('/api/v1/users/');
        expect(resetRes.status()).toBe(200);
        expect(resetRes.headers()['x-ratelimit-remaining']).toBe('2');
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });

    test('Health check route is exempt from rate limiting', async () => {
      const server = await createE2EServer(getRateLimitConfig(cacheConfig));

      try {
        await server.app.cache.clear();

        // Exhaust the rate limit
        for (let i = 0; i < 3; i++) {
          const res = await server.request.get('/api/v1/users/');
          expect(res.status()).toBe(200);
        }

        // Confirm normal API route is blocked
        const blockedRes = await server.request.get('/api/v1/users/');
        expect(blockedRes.status()).toBe(429);

        // Multiple health check calls succeed even when rate limited
        for (let i = 0; i < 5; i++) {
          const healthRes = await server.request.get('/api/health');
          expect(healthRes.status()).toBe(200);
          const healthBody = await healthRes.json();
          expect(healthBody.status).toBe('ok');
        }
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });

    test('Cross-method enforcement blocks any HTTP verb once limit reached', async () => {
      const server = await createE2EServer(getRateLimitConfig(cacheConfig));

      try {
        await server.app.cache.clear();

        // Consume 3 GET requests
        for (let i = 0; i < 3; i++) {
          const res = await server.request.get('/api/v1/users/');
          expect(res.status()).toBe(200);
        }

        // 4th request via POST is also blocked
        const postRes = await server.request.post('/api/v1/users/', {
          data: {email: 'test@example.com'},
        });
        expect(postRes.status()).toBe(429);
        expect(postRes.headers()['x-ratelimit-remaining']).toBe('0');
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });

    test('Disabled rate limiting allows unrestricted rapid hits without headers', async () => {
      const server = await createE2EServer(
        getRateLimitConfig(cacheConfig, {
          enabled: false,
          max: 3,
          timeWindow: '5s',
        }),
      );

      try {
        await server.app.cache.clear();

        // Send 10 rapid requests
        for (let i = 0; i < 10; i++) {
          const res = await server.request.get('/api/v1/users/');
          expect(res.status()).toBe(200);
          expect(res.headers()['x-ratelimit-limit']).toBeUndefined();
          expect(res.headers()['x-ratelimit-remaining']).toBeUndefined();
        }
      } finally {
        await server.app.cache.clear().catch(() => {});
        await server.cleanup();
      }
    });
  });
}

test.describe('Rate Limiting (Default Configuration)', () => {
  test('Omitted rateLimit defaults to disabled (no headers or throttling)', async () => {
    const config: AppConfigInput = {
      application: {
        name: 'Rocket E2E - Rate Limit Default',
        logLevel: 'warn',
        // rateLimit omitted intentionally
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
            },
          },
        },
      },
      apis: {},
    };

    const server = await createE2EServer(config);

    try {
      for (let i = 0; i < 10; i++) {
        const res = await server.request.get('/api/v1/users/');
        expect(res.status()).toBe(200);
        expect(res.headers()['x-ratelimit-limit']).toBeUndefined();
        expect(res.headers()['x-ratelimit-remaining']).toBeUndefined();
      }
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Rate Limiting (Negative Configuration & Validation)', () => {
  test('Startup rejects non-positive max (< 1)', async () => {
    const invalidConfig = getRateLimitConfig(undefined, {
      enabled: true,
      max: 0,
      timeWindow: '5s',
    });
    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /max must be >= 1/,
    );
  });

  test('Startup rejects non-integer max', async () => {
    const invalidConfig = getRateLimitConfig(undefined, {
      enabled: true,
      max: 3.5 as unknown as number,
      timeWindow: '5s',
    });
    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /max must be integer/,
    );
  });

  test('Startup rejects invalid timeWindow format', async () => {
    const invalidConfig = getRateLimitConfig(undefined, {
      enabled: true,
      max: 3,
      timeWindow: 'invalid' as unknown as string,
    });
    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /timeWindow must match pattern/,
    );
  });

  test('Startup rejects timeWindow with invalid unit (e.g. 5x)', async () => {
    const invalidConfig = getRateLimitConfig(undefined, {
      enabled: true,
      max: 3,
      timeWindow: '5x' as unknown as string,
    });
    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /timeWindow must match pattern/,
    );
  });

  test('Startup rejects non-boolean enabled', async () => {
    const invalidConfig = getRateLimitConfig(undefined, {
      enabled: 'true' as unknown as boolean,
      max: 3,
      timeWindow: '5s',
    });
    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /enabled must be boolean/,
    );
  });
});
