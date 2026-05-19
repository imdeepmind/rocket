import Fastify, {FastifyRequest} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import sspPlugin from '@/plugin/ssp';

import {AppConfig, SspConfig} from '@/interfaces/config';

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
          ssp: [],
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'qParam', value: 'qValue'},
      {paramType: 'body', paramName: 'bParam', value: 123},
      {paramType: 'path', paramName: 'pParam', value: true},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
      {paramType: 'body', paramName: 'userId', value: 'newUser'},
      {paramType: 'path', paramName: 'groupId', value: 'newGroup'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
      {paramType: 'body', paramName: 'userId', value: 'newUser'},
      {paramType: 'path', paramName: 'groupId', value: 'newGroup'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'ownerId', value: '[userId]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'body', paramName: 'user_email', value: '[userEmail]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'ownerId', value: '[userId]'},
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          ssp: ssps,
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
});
