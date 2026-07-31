import Fastify, {FastifyRequest} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import sspPlugin from '@/plugin/ssp';

import {AppConfig, ServerSideParamConfig} from '@/interfaces/config';

describe('ssp plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ssp plugin decorates fastify with enforceSSP', async () => {
    const app = Fastify();
    app.appConfig = {application: {logLevel: 'silent'}} as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    expect(app.hasDecorator('enforceSSP')).toBe(true);
  });

  it('should not modify the request if apiIdentifier is missing', async () => {
    const app = Fastify();
    app.appConfig = {application: {logLevel: 'silent'}} as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {foo: 'bar'},
      body: {baz: 'qux'},
      params: {id: '1'},
      routeOptions: {
        config: {},
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({foo: 'bar'});
    expect(request.body).toEqual({baz: 'qux'});
    expect(request.params).toEqual({id: '1'});
  });

  it('should not modify request if no ssp configs exist for the API', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {foo: 'bar'},
      body: {baz: 'qux'},
      params: {id: '1'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({foo: 'bar'});
    expect(request.body).toEqual({baz: 'qux'});
    expect(request.params).toEqual({id: '1'});
  });

  it('should add SSP values to query, body, and params if missing', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'qParam', value: 'qValue'},
      {type: 'body', name: 'bParam', value: 123},
      {type: 'path', name: 'pParam', value: true},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {foo: 'bar'},
      body: {baz: 'qux'},
      params: {id: '1'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({foo: 'bar', qParam: 'qValue'});
    expect(request.body).toEqual({baz: 'qux', bParam: 123});
    expect(request.params).toEqual({id: '1', pParam: true});
  });

  it('should overwrite existing values in query, body, and params', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'newTenant'},
      {type: 'body', name: 'userId', value: 'newUser'},
      {type: 'path', name: 'groupId', value: 'newGroup'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {tenantId: 'oldTenant'},
      body: {userId: 'oldUser'},
      params: {groupId: 'oldGroup'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({tenantId: 'newTenant'});
    expect(request.body).toEqual({userId: 'newUser'});
    expect(request.params).toEqual({groupId: 'newGroup'});
  });

  it('should handle missing request properties gracefully', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'newTenant'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    expect(() => app.enforceSSP(request)).not.toThrow();
    expect(request.query).toBeUndefined();
  });

  it('should not apply SSPs if the target property is an array', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'newTenant'},
      {type: 'body', name: 'userId', value: 'newUser'},
      {type: 'path', name: 'groupId', value: 'newGroup'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: ['not', 'an', 'object'],
      body: [{item: 1}, {item: 2}],
      params: ['param1', 'param2'],
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual(['not', 'an', 'object']);
    expect(request.body).toEqual([{item: 1}, {item: 2}]);
    expect(request.params).toEqual(['param1', 'param2']);
  });

  it('should replace [userId] magic variable with request.user.id', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'ownerId', value: '[userId]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      user: {id: 42, email: 'test@example.com'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({ownerId: 42});
  });

  it('should replace [userEmail] magic variable with request.user.email', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'body', name: 'user_email', value: '[userEmail]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      body: {},
      user: {id: 42, email: 'test@example.com'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.body).toEqual({user_email: 'test@example.com'});
  });

  it('should handle missing request.user when magic variables are used', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'ownerId', value: '[userId]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({ownerId: undefined});
  });

  it('should replace custom magic variable from application.magicVariables', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'org', value: '[defaultOrg]'},
    ];

    app.appConfig = {
      application: {
        logLevel: 'silent',
        magicVariables: {defaultOrg: 'rocket-oss'},
      },
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({org: 'rocket-oss'});
  });

  it('should support string, number, and boolean custom magic variables', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'strVal', value: '[myString]'},
      {type: 'query', name: 'numVal', value: '[myNumber]'},
      {type: 'query', name: 'boolVal', value: '[myBool]'},
    ];

    app.appConfig = {
      application: {
        logLevel: 'silent',
        magicVariables: {myString: 'hello', myNumber: 42, myBool: true},
      },
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({strVal: 'hello', numVal: 42, boolVal: true});
  });

  it('custom magic variable should override built-in [userId]', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'ownerId', value: '[userId]'},
    ];

    app.appConfig = {
      application: {
        logLevel: 'silent',
        magicVariables: {userId: 'overridden-user-id'},
      },
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      user: {id: 42, email: 'test@example.com'},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({ownerId: 'overridden-user-id'});
  });

  it('unknown bracket variable should fall back to literal value', async () => {
    const app = Fastify();
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'unknown', value: '[notDefinedAnywhere]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: ssps,
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    const request = {
      query: {},
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    app.enforceSSP(request);

    expect(request.query).toEqual({unknown: '[notDefinedAnywhere]'});
  });

  it('should handle apiIdentifier not found in apis config', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
    } as unknown as AppConfig;
    await app.register(sspPlugin);
    await app.ready();

    app.enforceSSP({
      query: {foo: 'bar'},
      routeOptions: {
        config: {apiIdentifier: 'unknown-api'},
      },
    } as unknown as FastifyRequest);
  });
});

// ---------------------------------------------------------------------------
// Tests for onRoute hook – strips SSP from route schemas
// ---------------------------------------------------------------------------
describe('ssp plugin – onRoute hook', () => {
  it('should strip query SSP params from route schema querystring', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [
            {type: 'query', name: 'tenantId', value: 'tenant-1'},
          ],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.config?.apiIdentifier === 'test-api') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.get('/test', {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            tenantId: {type: 'string'},
            name: {type: 'string'},
          },
        },
      },
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const qs = schema.querystring as Record<string, unknown>;
    const props = qs.properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('tenantId');
    expect(props).toHaveProperty('name');
  });

  it('should strip query filter variants from route schema', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [{type: 'query', name: 'org_id', value: '123'}],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.config?.apiIdentifier === 'test-api') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.get('/test', {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            org_id_eq: {type: 'string'},
            org_id_lt: {type: 'string'},
            name_eq: {type: 'string'},
          },
        },
      },
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const qs = schema.querystring as Record<string, unknown>;
    const props = qs.properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('org_id_eq');
    expect(props).not.toHaveProperty('org_id_lt');
    expect(props).toHaveProperty('name_eq');
  });

  it('should strip body SSP params from route schema body', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [{type: 'body', name: 'org_id', value: 'abc'}],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.config?.apiIdentifier === 'test-api') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.post('/test', {
      schema: {
        body: {
          type: 'object',
          properties: {org_id: {type: 'string'}, name: {type: 'string'}},
          required: ['org_id', 'name'],
        },
      },
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const body = schema.body as Record<string, unknown>;
    const props = body.properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('org_id');
    expect(props).toHaveProperty('name');
    expect(body.required).toEqual(['name']);
  });

  it('should NOT strip path SSP params from route schema', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [{type: 'path', name: 'id', value: '456'}],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.config?.apiIdentifier === 'test-api') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.get('/test/:id', {
      schema: {
        params: {
          type: 'object',
          properties: {id: {type: 'integer'}},
          required: ['id'],
        },
      },
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const params = schema.params as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;
    expect(props).toHaveProperty('id');
  });

  it('should not modify schema when api has no serverSideParams', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {},
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.config?.apiIdentifier === 'test-api') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.get('/test', {
      schema: {
        querystring: {
          type: 'object',
          properties: {tenantId: {type: 'string'}},
        },
      },
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const qs = schema.querystring as Record<string, unknown>;
    const props = qs.properties as Record<string, unknown>;
    expect(props).toHaveProperty('tenantId');
  });

  it('should not modify schema when route has no apiIdentifier', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [{type: 'query', name: 'tenantId', value: 'x'}],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    let capturedSchema: unknown;
    app.addHook('onRoute', routeOptions => {
      if (routeOptions.url === '/test-no-ssp') {
        capturedSchema = routeOptions.schema;
      }
    });

    app.get('/test-no-ssp', {
      schema: {
        querystring: {
          type: 'object',
          properties: {tenantId: {type: 'string'}},
        },
      },
      handler: async () => ({ok: true}),
    });

    await app.ready();

    const schema = capturedSchema as Record<string, unknown>;
    const qs = schema.querystring as Record<string, unknown>;
    const props = qs.properties as Record<string, unknown>;
    expect(props).toHaveProperty('tenantId');
  });

  it('should handle routes without a schema gracefully', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          serverSideParams: [{type: 'query', name: 'tenantId', value: 'x'}],
        },
      },
    } as unknown as AppConfig;
    await app.register(sspPlugin);

    app.get('/no-schema', {
      config: {apiIdentifier: 'test-api'},
      handler: async () => ({ok: true}),
    });

    await app.ready();
  });
});
