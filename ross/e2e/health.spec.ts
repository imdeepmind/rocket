import {expect, test} from '@playwright/test';

import {
  DEFAULT_TEST_PG_URL,
  DEFAULT_TEST_REDIS_URL,
  UNREACHABLE_PG_URL,
  UNREACHABLE_REDIS_URL,
} from './helpers/constants';
import {createE2EServer} from './helpers/server';

test.describe('Configuration Defaults & Overrides', () => {
  test('Default healthCheck (omitted in config) defaults to enabled at /api/health', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - Defaults',
        logLevel: 'warn',
        // healthCheck omitted intentionally to test framework defaults
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache.status).toBe('up');
    } finally {
      await server.cleanup();
    }
  });

  test('Custom path (healthCheck.path: "/status") mounts at /api/status', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - Custom Path',
        logLevel: 'warn',
        healthCheck: {
          enabled: true,
          path: '/status',
        },
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
    });

    try {
      const customRes = await server.request.get('/api/status');
      expect(customRes.status()).toBe(200);

      const body = await customRes.json();
      expect(body.status).toBe('ok');

      // Default path should return 404 since path was customized
      const defaultRes = await server.request.get('/api/health');
      expect(defaultRes.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('Disabled healthCheck (enabled: false) returns 404', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - Disabled',
        logLevel: 'warn',
        healthCheck: {
          enabled: false,
        },
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Database & Cache Matrix', () => {
  test('SQLite + In-Memory Cache (No Redis)', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - SQLite Memory',
        logLevel: 'warn',
        healthCheck: {enabled: true, path: '/health'},
      },
      docs: {openapi: {enabled: true, path: '/api/docs'}},
      infrastructure: {
        database: {
          engine: 'sqlite',
          connection: {url: './e2e/.data/test.db'},
        },
        cache: {engine: 'memory'},
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache.status).toBe('up');

      const docsRes = await server.request.get('/api/docs/json');
      expect(docsRes.status()).toBe(200);
      const docsBody = await docsRes.json();
      expect(docsBody.openapi).toBeDefined();
      expect(docsBody.info?.title).toBe('Rocket E2E - SQLite Memory');
    } finally {
      await server.cleanup();
    }
  });

  test('SQLite + Redis Cache', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - SQLite Redis',
        logLevel: 'warn',
        healthCheck: {enabled: true, path: '/health'},
      },
      infrastructure: {
        database: {
          engine: 'sqlite',
          connection: {url: './e2e/.data/test.db'},
        },
        cache: {
          engine: 'redis',
          connection: {url: DEFAULT_TEST_REDIS_URL},
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache.status).toBe('up');
    } finally {
      await server.cleanup();
    }
  });

  test('PostgreSQL + In-Memory Cache (No Redis)', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - PG Memory',
        logLevel: 'warn',
        healthCheck: {enabled: true, path: '/health'},
      },
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: DEFAULT_TEST_PG_URL},
        },
        cache: {engine: 'memory'},
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache.status).toBe('up');
    } finally {
      await server.cleanup();
    }
  });

  test('PostgreSQL + Redis Cache', async () => {
    const server = await createE2EServer({
      application: {
        name: 'Rocket E2E - PG Redis',
        logLevel: 'warn',
        healthCheck: {enabled: true, path: '/health'},
      },
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: DEFAULT_TEST_PG_URL},
        },
        cache: {
          engine: 'redis',
          connection: {url: DEFAULT_TEST_REDIS_URL},
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
    });

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('up');
      expect(body.services.cache.status).toBe('up');
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Negative & Degraded Service Health (503 & Startup Failure)', () => {
  test('Server startup fails when configured Redis is unreachable', async () => {
    await expect(
      createE2EServer({
        application: {
          name: 'Rocket E2E - Redis Down',
          logLevel: 'warn',
          healthCheck: {enabled: true, path: '/health'},
        },
        infrastructure: {
          database: {
            engine: 'sqlite',
            connection: {url: './e2e/.data/test.db'},
          },
          cache: {
            engine: 'redis',
            connection: {url: UNREACHABLE_REDIS_URL},
            timeout: 100,
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
      }),
    ).rejects.toThrow();
  });

  test('Returns 503 degraded when PostgreSQL database is unreachable', async () => {
    const server = await createE2EServer(
      {
        application: {
          name: 'Rocket E2E - PG Down',
          logLevel: 'warn',
          healthCheck: {enabled: true, path: '/health'},
        },
        infrastructure: {
          database: {
            engine: 'postgres',
            connection: {url: UNREACHABLE_PG_URL},
            timeout: 300,
          },
          cache: {engine: 'memory'},
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
      },
      {migrate: false},
    );

    try {
      const res = await server.request.get('/api/health');
      expect(res.status()).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('degraded');
      expect(body.services.database.status).toBe('down');
      expect(body.services.database.error).toBeDefined();
      expect(body.services.cache.status).toBe('up');
    } finally {
      await server.cleanup();
    }
  });
});
