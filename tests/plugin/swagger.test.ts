import Fastify from 'fastify';
import {describe, expect, it} from 'vitest';

import swaggerPlugin from '@/plugin/swagger';

const baseConfig = {
  application: {name: 'test', logLevel: 'error'},
  docs: {
    openapi: {
      enabled: true,
      path: '/docs',
      info: {
        title: 'Test API',
        description: 'Test description',
        version: '1.0.0',
      },
    },
  },
  infrastructure: {
    primaryDatabase: {engine: 'sqlite', connection: {url: ':memory:'}},
  },
  models: [],
};

describe('Swagger Plugin', () => {
  it('should register swagger UI at the configured path', async () => {
    const app = Fastify();
    app.appConfig = structuredClone(baseConfig) as typeof app.appConfig;
    await app.register(swaggerPlugin);
    await app.ready();

    const res = await app.inject({method: 'GET', url: '/docs'});
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('swagger');

    await app.close();
  });

  it('should serve OpenAPI spec with correct info', async () => {
    const app = Fastify();
    app.appConfig = structuredClone(baseConfig) as typeof app.appConfig;
    await app.register(swaggerPlugin);
    await app.ready();

    const res = await app.inject({method: 'GET', url: '/docs/json'});
    expect(res.statusCode).toBe(200);
    const spec = JSON.parse(res.body);
    expect(spec.info.title).toBe('Test API');
    expect(spec.info.description).toBe('Test description');
    expect(spec.info.version).toBe('1.0.0');

    await app.close();
  });

  it('should include bearerAuth security scheme when up-auth is enabled', async () => {
    const app = Fastify();
    app.appConfig = structuredClone(baseConfig) as typeof app.appConfig;
    app.appConfig.authentication = {
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
        },
      },
    };
    await app.register(swaggerPlugin);
    await app.ready();

    const res = await app.inject({method: 'GET', url: '/docs/json'});
    expect(res.statusCode).toBe(200);
    const spec = JSON.parse(res.body);
    expect(spec.components.securitySchemes).toHaveProperty('bearerAuth');
    expect(spec.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });

    await app.close();
  });

  it('should include apiKeyAuth security scheme when api-key is enabled', async () => {
    const app = Fastify();
    app.appConfig = structuredClone(baseConfig) as typeof app.appConfig;
    app.appConfig.authentication = {
      enabled: true,
      provider: {
        type: 'api-key',
        config: {
          key: 'test-key',
        },
      },
    };
    await app.register(swaggerPlugin);
    await app.ready();

    const res = await app.inject({method: 'GET', url: '/docs/json'});
    expect(res.statusCode).toBe(200);
    const spec = JSON.parse(res.body);
    expect(spec.components.securitySchemes).toHaveProperty('apiKeyAuth');
    expect(spec.components.securitySchemes.apiKeyAuth).toEqual({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    });

    await app.close();
  });

  it('should not include security schemes when auth is not configured', async () => {
    const app = Fastify();
    app.appConfig = structuredClone(baseConfig) as typeof app.appConfig;
    await app.register(swaggerPlugin);
    await app.ready();

    const res = await app.inject({method: 'GET', url: '/docs/json'});
    expect(res.statusCode).toBe(200);
    const spec = JSON.parse(res.body);
    expect(spec.components.securitySchemes).toBeUndefined();

    await app.close();
  });
});
