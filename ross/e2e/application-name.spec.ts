import {expect, test} from '@playwright/test';

import {AppConfigInput} from '@/interfaces/config';

import {createE2EServer} from './helpers/server';

function getAppNameTestConfig(
  name?: unknown,
  extraConfig?: Partial<AppConfigInput>,
): AppConfigInput {
  const application: Record<string, unknown> = {
    logLevel: 'warn',
    healthCheck: {
      enabled: true,
      path: '/api/health',
    },
  };

  if (name !== undefined) {
    application.name = name;
  }

  return {
    application: application as AppConfigInput['application'],
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {url: './e2e/.data/test.db'},
      },
    },
    data: {
      models: {
        items: {
          fields: {
            id: {
              type: 'integer',
              primaryKey: true,
              autoIncrement: true,
              nullable: false,
            },
            title: {
              type: 'string',
              nullable: false,
            },
          },
        },
      },
    },
    apis: {},
    ...extraConfig,
  };
}

test.describe('Application Name (`application.name`) E2E', () => {
  test('Propagates application.name as default OpenAPI info.title in /docs/json', async () => {
    const server = await createE2EServer(
      getAppNameTestConfig('Acme Commerce API'),
    );

    try {
      const res = await server.request.get('/docs/json');
      expect(res.status()).toBe(200);

      const spec = await res.json();
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('Acme Commerce API');
      expect(spec.info.version).toBe('1.0.0');
    } finally {
      await server.cleanup();
    }
  });

  test('Explicit docs.openapi.info.title overrides application.name in OpenAPI spec', async () => {
    const server = await createE2EServer(
      getAppNameTestConfig('Underlying App Name', {
        docs: {
          openapi: {
            info: {
              title: 'Explicit Documentation Title',
            },
          },
        },
      }),
    );

    try {
      const res = await server.request.get('/docs/json');
      expect(res.status()).toBe(200);

      const spec = await res.json();
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('Explicit Documentation Title');
      expect(server.app.appConfig.application.name).toBe('Underlying App Name');
    } finally {
      await server.cleanup();
    }
  });

  test('Propagates application.name when docs.openapi.path is customized', async () => {
    const server = await createE2EServer(
      getAppNameTestConfig('Custom Reference API', {
        docs: {
          openapi: {
            path: '/api-docs',
          },
        },
      }),
    );

    try {
      const res = await server.request.get('/api-docs/json');
      expect(res.status()).toBe(200);

      const spec = await res.json();
      expect(spec.info.title).toBe('Custom Reference API');
    } finally {
      await server.cleanup();
    }
  });
});

test.describe('Application Name (`application.name`) Schema Validation', () => {
  test('Startup rejects configuration when application.name is omitted', async () => {
    const invalidConfig = getAppNameTestConfig(undefined);

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /must have required property 'name'/,
    );
  });

  test('Startup rejects configuration when application.name is empty string', async () => {
    const invalidConfig = getAppNameTestConfig('');

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /name.*must NOT have fewer than 1 characters/,
    );
  });

  test('Startup rejects configuration when application.name is non-string (number)', async () => {
    const invalidConfig = getAppNameTestConfig(12345);

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /name.*must be string/,
    );
  });

  test('Startup rejects configuration when application.name is non-string (boolean)', async () => {
    const invalidConfig = getAppNameTestConfig(true);

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      /name.*must be string/,
    );
  });
});
