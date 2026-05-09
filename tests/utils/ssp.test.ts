import {FastifyRequest} from 'fastify';
import {describe, expect, it} from 'vitest';

import {SspConfig} from '@/interfaces/config';

import {enforceSSP} from '@/utils/ssp';

describe('enforceSSP', () => {
  it('should not modify the request if ssps array is empty', () => {
    const request = {
      query: {foo: 'bar'},
      body: {baz: 'qux'},
      params: {id: '1'},
    } as unknown as FastifyRequest;

    enforceSSP([], request);

    expect(request.query).toEqual({foo: 'bar'});
    expect(request.body).toEqual({baz: 'qux'});
    expect(request.params).toEqual({id: '1'});
  });

  it('should add SSP values to query, body, and params if missing', () => {
    const request = {
      query: {foo: 'bar'},
      body: {baz: 'qux'},
      params: {id: '1'},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'qParam', value: 'qValue'},
      {paramType: 'body', paramName: 'bParam', value: 123},
      {paramType: 'path', paramName: 'pParam', value: true},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({foo: 'bar', qParam: 'qValue'});
    expect(request.body).toEqual({baz: 'qux', bParam: 123});
    expect(request.params).toEqual({id: '1', pParam: true});
  });

  it('should overwrite existing values in query, body, and params', () => {
    const request = {
      query: {tenantId: 'oldTenant'},
      body: {userId: 'oldUser'},
      params: {groupId: 'oldGroup'},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
      {paramType: 'body', paramName: 'userId', value: 'newUser'},
      {paramType: 'path', paramName: 'groupId', value: 'newGroup'},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({tenantId: 'newTenant'});
    expect(request.body).toEqual({userId: 'newUser'});
    expect(request.params).toEqual({groupId: 'newGroup'});
  });

  it('should handle missing request properties gracefully (undefined/null)', () => {
    const request = {
      // query, body, and params are missing/undefined
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
    ];

    expect(() => enforceSSP(ssps, request)).not.toThrow();
    // Since they are undefined, enforceSSP should just ignore them and not mutate or throw
    expect(request.query).toBeUndefined();
  });

  it('should not apply SSPs if the target property is an array', () => {
    const request = {
      query: ['not', 'an', 'object'],
      body: [{item: 1}, {item: 2}],
      params: ['param1', 'param2'],
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'tenantId', value: 'newTenant'},
      {paramType: 'body', paramName: 'userId', value: 'newUser'},
      {paramType: 'path', paramName: 'groupId', value: 'newGroup'},
    ];

    enforceSSP(ssps, request);

    // Arrays should remain untouched, not converted to objects or mutated with string keys
    expect(request.query).toEqual(['not', 'an', 'object']);
    expect(request.body).toEqual([{item: 1}, {item: 2}]);
    expect(request.params).toEqual(['param1', 'param2']);
  });

  it('should handle applying multiple SSPs to the same target type', () => {
    const request = {
      query: {foo: 'bar'},
      body: {},
      params: {},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'param1', value: 'val1'},
      {paramType: 'query', paramName: 'param2', value: 'val2'},
      {paramType: 'query', paramName: 'param3', value: 'val3'},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({
      foo: 'bar',
      param1: 'val1',
      param2: 'val2',
      param3: 'val3',
    });
  });

  it('should apply the last SSP value if multiple SSPs have the same paramName and paramType', () => {
    const request = {
      query: {},
      body: {},
      params: {},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'duplicateKey', value: 'firstValue'},
      {paramType: 'query', paramName: 'duplicateKey', value: 'secondValue'},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({duplicateKey: 'secondValue'});
  });

  it('should replace [userId] magic variable with request.user.id', () => {
    const request = {
      query: {},
      user: {id: 42, email: 'test@example.com'},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'ownerId', value: '[userId]'},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({ownerId: 42});
  });

  it('should replace [userEmail] magic variable with request.user.email', () => {
    const request = {
      body: {},
      user: {id: 42, email: 'test@example.com'},
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'body', paramName: 'user_email', value: '[userEmail]'},
    ];

    enforceSSP(ssps, request);

    expect(request.body).toEqual({user_email: 'test@example.com'});
  });

  it('should handle missing request.user when magic variables are used', () => {
    const request = {
      query: {},
      // no user object
    } as unknown as FastifyRequest;

    const ssps: SspConfig[] = [
      {paramType: 'query', paramName: 'ownerId', value: '[userId]'},
    ];

    enforceSSP(ssps, request);

    expect(request.query).toEqual({ownerId: undefined});
  });
});
