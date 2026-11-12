import {describe, expect, it} from 'vitest';

import {stripServerSideParamsFromSchema} from '@/lib/schema/ssp';

import {ServerSideParamConfig} from '@/interfaces/config';

describe('stripServerSideParamsFromSchema', () => {
  it('should do nothing when serverSideParams is empty', () => {
    const schema: Record<string, unknown> = {
      querystring: {type: 'object', properties: {foo: {type: 'string'}}},
    };
    stripServerSideParamsFromSchema(schema, []);
    expect(schema).toEqual({
      querystring: {type: 'object', properties: {foo: {type: 'string'}}},
    });
  });

  it('should strip exact query param names from querystring', () => {
    const schema: Record<string, unknown> = {
      querystring: {
        type: 'object',
        properties: {
          tenantId: {type: 'string'},
          name_eq: {type: 'string'},
        },
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'abc'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema.querystring).toBeDefined();
    const props = (schema.querystring as Record<string, unknown>)
      .properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('tenantId');
    expect(props).toHaveProperty('name_eq');
  });

  it('should strip filter variants (field_eq, field_lt) from querystring', () => {
    const schema: Record<string, unknown> = {
      querystring: {
        type: 'object',
        properties: {
          org_id_eq: {type: 'string'},
          org_id_lt: {type: 'string'},
          org_id_gt: {type: 'string'},
          org_id_in: {type: 'string'},
          name_eq: {type: 'string'},
          name_ne: {type: 'string'},
        },
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'org_id', value: '123'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    const props = (schema.querystring as Record<string, unknown>)
      .properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('org_id_eq');
    expect(props).not.toHaveProperty('org_id_lt');
    expect(props).not.toHaveProperty('org_id_gt');
    expect(props).not.toHaveProperty('org_id_in');
    expect(props).toHaveProperty('name_eq');
    expect(props).toHaveProperty('name_ne');
  });

  it('should remove querystring entirely when all properties are stripped', () => {
    const schema: Record<string, unknown> = {
      querystring: {
        type: 'object',
        properties: {
          tenantId: {type: 'string'},
        },
        additionalProperties: false,
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema).not.toHaveProperty('querystring');
  });

  it('should strip body params from body schema and required array', () => {
    const schema: Record<string, unknown> = {
      body: {
        type: 'object',
        properties: {
          name: {type: 'string'},
          org_id: {type: 'string'},
          email: {type: 'string'},
        },
        required: ['name', 'org_id', 'email'],
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'body', name: 'org_id', value: 'abc'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    const body = schema.body as Record<string, unknown>;
    const props = body.properties as Record<string, unknown>;
    expect(props).not.toHaveProperty('org_id');
    expect(props).toHaveProperty('name');
    expect(props).toHaveProperty('email');
    expect(body.required).toEqual(['name', 'email']);
  });

  it('should remove body entirely when all properties are stripped, even with required', () => {
    const schema: Record<string, unknown> = {
      body: {
        type: 'object',
        properties: {
          org_id: {type: 'string'},
        },
        required: ['org_id'],
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'body', name: 'org_id', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema).not.toHaveProperty('body');
  });

  it('should remove body entirely when all properties are stripped', () => {
    const schema: Record<string, unknown> = {
      body: {
        type: 'object',
        properties: {org_id: {type: 'string'}},
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'body', name: 'org_id', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema).not.toHaveProperty('body');
  });

  it('should keep path params even when matching SSP is configured', () => {
    const schema: Record<string, unknown> = {
      params: {
        type: 'object',
        properties: {
          id: {type: 'integer'},
        },
        required: ['id'],
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'path', name: 'id', value: '123'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema.params).toBeDefined();
    const props = (schema.params as Record<string, unknown>)
      .properties as Record<string, unknown>;
    expect(props).toHaveProperty('id');
  });

  it('should handle mixed query, body, and path SSPs', () => {
    const schema: Record<string, unknown> = {
      params: {
        type: 'object',
        properties: {
          id: {type: 'integer'},
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          org_id_eq: {type: 'string'},
          name_eq: {type: 'string'},
        },
      },
      body: {
        type: 'object',
        properties: {
          org_id: {type: 'string'},
          name: {type: 'string'},
        },
        required: ['org_id', 'name'],
      },
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'org_id', value: '123'},
      {type: 'body', name: 'org_id', value: '123'},
      {type: 'path', name: 'id', value: '456'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);

    // path preserved
    expect(schema.params).toBeDefined();

    // query org_id_eq stripped, name_eq kept
    const qsProps = (schema.querystring as Record<string, unknown>)
      .properties as Record<string, unknown>;
    expect(qsProps).not.toHaveProperty('org_id_eq');
    expect(qsProps).toHaveProperty('name_eq');

    // body org_id stripped, name kept, required cleaned
    const body = schema.body as Record<string, unknown>;
    const bodyProps = body.properties as Record<string, unknown>;
    expect(bodyProps).not.toHaveProperty('org_id');
    expect(bodyProps).toHaveProperty('name');
    expect(body.required).toEqual(['name']);
  });

  it('should do nothing when schema has no querystring or body', () => {
    const schema: Record<string, unknown> = {
      params: {type: 'object', properties: {id: {type: 'integer'}}},
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'org_id', value: 'x'},
      {type: 'body', name: 'org_id', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema).toEqual({
      params: {type: 'object', properties: {id: {type: 'integer'}}},
    });
  });

  it('should handle querystring without properties gracefully', () => {
    const schema: Record<string, unknown> = {
      querystring: {type: 'object'},
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'query', name: 'tenantId', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema.querystring).toEqual({type: 'object'});
  });

  it('should handle body without properties gracefully', () => {
    const schema: Record<string, unknown> = {
      body: {type: 'object'},
    };
    const ssps: ServerSideParamConfig[] = [
      {type: 'body', name: 'org_id', value: 'x'},
    ];
    stripServerSideParamsFromSchema(schema, ssps);
    expect(schema.body).toEqual({type: 'object'});
  });
});
