import {expect, test} from '@playwright/test';

import {AppConfigInput} from '@/interfaces/config';

import {createE2EServer} from './helpers/server';

function getVariantTestConfig(
  variantOverride?: string,
  extraConfig?: Partial<AppConfigInput>,
): AppConfigInput {
  return {
    application: {
      name: 'Rocket E2E - Variant Override',
      logLevel: 'warn',
      ...(variantOverride !== undefined
        ? {dangerouslyOverrideDefaultVariant: variantOverride}
        : {}),
      healthCheck: {
        enabled: true,
        path: '/api/health',
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
              apis: ['index', 'edit', 'delete'],
            },
            name: {
              type: 'string',
              nullable: false,
            },
            email: {
              type: 'string',
              nullable: false,
              apis: ['search'],
            },
          },
        },
      },
    },
    apis: {},
    ...extraConfig,
  };
}

test.describe('Default Variant (dangerouslyOverrideDefaultVariant omitted)', () => {
  test('Defaults to v1 segment for model CRUD routes', async () => {
    const server = await createE2EServer(getVariantTestConfig());

    try {
      // v1 is active by default
      const resV1 = await server.request.get('/api/v1/users/');
      expect(resV1.status()).toBe(200);

      // Other variants do not exist
      const resV2 = await server.request.get('/api/v2/users/');
      expect(resV2.status()).toBe(404);

      // Verify route table lists /api/v1/ endpoints
      expect(server.routes.some(r => r.url.startsWith('/api/v1/users'))).toBe(
        true,
      );
      expect(server.routes.some(r => r.url.startsWith('/api/v2/users'))).toBe(
        false,
      );
    } finally {
      await server.cleanup();
    }
  });

  test('Startup rejects empty string dangerouslyOverrideDefaultVariant', async () => {
    await expect(createE2EServer(getVariantTestConfig(''))).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must NOT have fewer than 1 characters/,
    );
  });
});

test.describe('Overridden Variant: Model CRUD Operations', () => {
  test('Mounts all model CRUD endpoints on /api/v2/ and unmounts /api/v1/', async () => {
    const server = await createE2EServer(getVariantTestConfig('v2'));

    try {
      // 1. Create a user via POST /api/v2/users/
      const postRes = await server.request.post('/api/v2/users/', {
        data: {
          name: 'Alice Cooper',
          email: 'alice@example.com',
        },
      });
      expect(postRes.status()).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.code).toBe(201);
      expect(postBody.data.email).toBe('alice@example.com');

      // 2. Query all users via GET /api/v2/users/
      const getRes = await server.request.get('/api/v2/users/');
      expect(getRes.status()).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.code).toBe(200);
      expect(getBody.data.data.length).toBeGreaterThanOrEqual(1);
      expect(getBody.data.data[0].email).toBe('alice@example.com');

      // 3. Query specific user via GET /api/v2/users/id/1
      const getByIdRes = await server.request.get('/api/v2/users/id/1');
      expect(getByIdRes.status()).toBe(200);
      const getByIdBody = await getByIdRes.json();
      expect(getByIdBody.data.data.name).toBe('Alice Cooper');

      // 4. Update user via PATCH /api/v2/users/id/1
      const patchRes = await server.request.patch('/api/v2/users/id/1', {
        data: {
          name: 'Alice Updated',
        },
      });
      expect(patchRes.status()).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.name).toBe('Alice Updated');

      // 5. Search user via GET /api/v2/users/search/email
      const searchRes = await server.request.get(
        '/api/v2/users/search/email?email_search=alice',
      );
      expect(searchRes.status()).toBe(200);
      const searchBody = await searchRes.json();
      expect(searchBody.data.data.length).toBe(1);

      // 6. Delete user via DELETE /api/v2/users/id/1
      const deleteRes = await server.request.delete('/api/v2/users/id/1', {
        headers: {
          'content-type': 'text/plain',
        },
      });
      expect(deleteRes.status()).toBe(204);

      // 7. Verify /api/v1/ endpoints are not registered (404)
      const oldGetRes = await server.request.get('/api/v1/users/');
      expect(oldGetRes.status()).toBe(404);

      const oldPostRes = await server.request.post('/api/v1/users/', {
        data: {
          name: 'Bob',
          email: 'bob@example.com',
        },
      });
      expect(oldPostRes.status()).toBe(404);

      // Verify route table confirms prefix swap
      expect(server.routes.some(r => r.url.startsWith('/api/v2/users'))).toBe(
        true,
      );
      expect(server.routes.some(r => r.url.startsWith('/api/v1/users'))).toBe(
        false,
      );
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Overridden Variant: Custom Endpoints & Authentication', () => {
  test('Mounts custom endpoint on /api/v2/custom-endpoints/ and returns 404 on /api/v1/', async () => {
    const server = await createE2EServer(
      getVariantTestConfig('v2', {
        customEndpoints: {
          ping: {
            method: 'GET',
            path: '/ping',
            description: 'Ping health endpoint',
            handler: {
              type: 'sql',
              sql: 'SELECT 1 as result;',
            },
          },
        },
      }),
    );

    try {
      // New v2 custom endpoint path responds
      const resV2 = await server.request.get('/api/v2/custom-endpoints/ping');
      expect(resV2.status()).toBe(200);
      const bodyV2 = await resV2.json();
      expect(bodyV2.code).toBe(200);

      // Old v1 custom endpoint path returns 404
      const resV1 = await server.request.get('/api/v1/custom-endpoints/ping');
      expect(resV1.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('Mounts authentication routes on /api/v2/auth/ and returns 404 on /api/v1/', async () => {
    const server = await createE2EServer(
      getVariantTestConfig('v2', {
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
                password: {
                  type: 'string',
                  nullable: false,
                  secret: true,
                },
              },
            },
          },
        },
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
              jwtSecret:
                'e2e-variant-override-secret-key-at-least-32-chars-long!',
            },
          },
        },
      }),
    );

    try {
      // 1. Register user via POST /api/v2/auth/register
      const regRes = await server.request.post('/api/v2/auth/register', {
        data: {
          email: 'variant-user@example.com',
          password: 'Password123!',
        },
      });
      expect(regRes.status()).toBe(201);

      // 2. Log in via POST /api/v2/auth/login
      const loginRes = await server.request.post('/api/v2/auth/login', {
        data: {
          email: 'variant-user@example.com',
          password: 'Password123!',
        },
      });
      expect(loginRes.status()).toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.data).toHaveProperty('accessToken');
      const token = loginBody.data.accessToken;

      // 3. Verify user identity via GET /api/v2/auth/user/me
      const meRes = await server.request.get('/api/v2/auth/user/me', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(meRes.status()).toBe(200);
      const meBody = await meRes.json();
      expect(meBody.data.email).toBe('variant-user@example.com');

      // 4. Verify old /api/v1/auth/ routes return 404
      const oldLoginRes = await server.request.post('/api/v1/auth/login', {
        data: {
          email: 'variant-user@example.com',
          password: 'Password123!',
        },
      });
      expect(oldLoginRes.status()).toBe(404);

      const oldRegRes = await server.request.post('/api/v1/auth/register', {
        data: {
          email: 'variant-user@example.com',
          password: 'Password123!',
        },
      });
      expect(oldRegRes.status()).toBe(404);

      const oldMeRes = await server.request.get('/api/v1/auth/user/me', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(oldMeRes.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('Health check endpoint remains invariant at /api/health', async () => {
    const server = await createE2EServer(getVariantTestConfig('v2'));

    try {
      // Health check is exempt from variant segment
      const healthRes = await server.request.get('/api/health');
      expect(healthRes.status()).toBe(200);
      const healthBody = await healthRes.json();
      expect(healthBody.status).toBe('ok');

      // /api/v2/health is not registered
      const variantHealthRes = await server.request.get('/api/v2/health');
      expect(variantHealthRes.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Overridden Variant: Syntax Formats & Boundary Values', () => {
  test('Mounts successfully with descriptive word (e.g. "beta")', async () => {
    const server = await createE2EServer(getVariantTestConfig('beta'));

    try {
      const res = await server.request.get('/api/beta/users/');
      expect(res.status()).toBe(200);

      const oldRes = await server.request.get('/api/v1/users/');
      expect(oldRes.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('Mounts successfully with hyphenated and underscored names (e.g. "preview-2026", "test_variant")', async () => {
    const server = await createE2EServer(getVariantTestConfig('preview-2026'));

    try {
      const res = await server.request.get('/api/preview-2026/users/');
      expect(res.status()).toBe(200);
    } finally {
      await server.cleanup();
    }
  });

  test('Mounts successfully at maximum allowed length boundary (25 characters)', async () => {
    const maxLengthVariant = 'abcdefghijklmnopqrstuvwxy'; // Exactly 25 chars
    expect(maxLengthVariant.length).toBe(25);

    const server = await createE2EServer(
      getVariantTestConfig(maxLengthVariant),
    );

    try {
      const res = await server.request.get(`/api/${maxLengthVariant}/users/`);
      expect(res.status()).toBe(200);
    } finally {
      await server.cleanup();
    }
  });

  test('Preserves case-sensitivity in route URLs (e.g. "Variant-V2")', async () => {
    const server = await createE2EServer(getVariantTestConfig('Variant-V2'));

    try {
      const res = await server.request.get('/api/Variant-V2/users/');
      expect(res.status()).toBe(200);
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Multi-Variant Coexistence via apiVariants', () => {
  test('Serves both overridden default variant and configured secondary variants', async () => {
    const server = await createE2EServer(
      getVariantTestConfig('v2', {
        apiVariants: {
          'model.v2.users.unknown.getAll': {
            variants: ['v1', 'preview-v3'],
          },
        },
      }),
    );

    try {
      // Overridden default variant is active
      const resV2 = await server.request.get('/api/v2/users/');
      expect(resV2.status()).toBe(200);

      // Secondary variants explicitly enabled in apiVariants are also active
      const resV1 = await server.request.get('/api/v1/users/');
      expect(resV1.status()).toBe(200);

      const resPreview = await server.request.get('/api/preview-v3/users/');
      expect(resPreview.status()).toBe(200);

      // Unconfigured variants remain 404
      const resV4 = await server.request.get('/api/v4/users/');
      expect(resV4.status()).toBe(404);
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Policy Overrides via config.apis', () => {
  test('Disables endpoint when configured with new variant identifier in apis', async () => {
    const server = await createE2EServer(
      getVariantTestConfig('v2', {
        apis: {
          'model.v2.users.unknown.getAll': {
            enabled: false,
          },
        },
      }),
    );

    try {
      // GET /api/v2/users/ disabled via policy override
      const getRes = await server.request.get('/api/v2/users/');
      expect(getRes.status()).toBe(404);

      // POST /api/v2/users/ is not disabled and succeeds
      const postRes = await server.request.post('/api/v2/users/', {
        data: {
          name: 'Charlie',
          email: 'charlie@example.com',
        },
      });
      expect(postRes.status()).toBe(201);
    } finally {
      await server.cleanup();
    }
  });

  test('Startup rejects obsolete v1 identifier in apis when default variant is overridden', async () => {
    const invalidConfig = getVariantTestConfig('v2', {
      apis: {
        'model.v1.users.unknown.getAll': {
          enabled: false,
        },
      },
    });

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /apis\/model\.v1\.users\.unknown\.getAll.*does not match any generated API route/,
    );
  });
});

test.describe('Negative Startup & Schema Validation', () => {
  test('Startup rejects variant exceeding 25 characters', async () => {
    const invalidConfig = getVariantTestConfig('a'.repeat(26));

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must NOT have more than 25 characters/,
    );
  });

  test('Startup rejects variant containing whitespace ("v 2")', async () => {
    const invalidConfig = getVariantTestConfig('v 2');

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must match pattern/,
    );
  });

  test('Startup rejects variant containing dot ("v1.0")', async () => {
    const invalidConfig = getVariantTestConfig('v1.0');

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must match pattern/,
    );
  });

  test('Startup rejects variant containing slash ("v1/v2")', async () => {
    const invalidConfig = getVariantTestConfig('v1/v2');

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must match pattern/,
    );
  });

  test('Startup rejects variant containing symbol ("v2@beta")', async () => {
    const invalidConfig = getVariantTestConfig('v2@beta');

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must match pattern/,
    );
  });

  test('Startup rejects non-string variant (number)', async () => {
    const invalidConfig = getVariantTestConfig(2 as unknown as string);

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must be string/,
    );
  });

  test('Startup rejects non-string variant (boolean)', async () => {
    const invalidConfig = getVariantTestConfig(true as unknown as string);

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /dangerouslyOverrideDefaultVariant.*must be string/,
    );
  });
});
