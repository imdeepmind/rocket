import {describe, expect, it, test, vi} from 'vitest';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildPreValidation,
  buildSecurityArray,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {
  AppConfig,
  DataType,
  ModelConfig,
  ModelFieldConfig,
} from '@/interfaces/config';

describe('test schema helper', () => {
  // test cases for mapDataTypeToJsonSchema
  it.each([
    {dataType: 'string', expectedSchema: {type: 'string'}},
    {dataType: 'integer', expectedSchema: {type: 'integer'}},
    {dataType: 'boolean', expectedSchema: {type: 'boolean'}},
    {dataType: 'text', expectedSchema: {type: 'string'}},
    {
      dataType: 'datetime',
      expectedSchema: {type: 'string', format: 'date-time'},
    },
    {dataType: 'decimal', expectedSchema: {type: 'number'}},
    {dataType: 'date', expectedSchema: {type: 'string', format: 'date'}},
    {dataType: 'array', expectedSchema: {type: 'string'}},
    {dataType: 'null', expectedSchema: {type: 'string'}},
  ])('should map $dataType to JSON schema', ({dataType, expectedSchema}) => {
    expect(mapDataTypeToJsonSchema(dataType as DataType)).toEqual(
      expectedSchema,
    );
  });

  // test cases for buildSortQueryProperties
  test('should build sort query properties', () => {
    const sortableFields = ['id', 'name', 'age'];
    const expectedSchema = {
      orderBy: {
        type: 'string',
        enum: sortableFields,
        description: `Column to sort by. Allowed: ${sortableFields.join(', ')}`,
      },
      orderDir: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction',
        default: 'asc',
      },
    };
    expect(buildSortQueryProperties(sortableFields)).toEqual(expectedSchema);
  });

  // test cases for buildFilterQueryProperties
  test('should build filter query properties', () => {
    const field: ModelFieldConfig = {
      type: 'integer',
      query: ['lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
    };
    const expectedSchema = {
      age_lt: {
        type: 'integer',
        description: 'Filter where age is less than this value',
      },
      age_lte: {
        type: 'integer',
        description: 'Filter where age is less than or equal to this value',
      },
      age_gt: {
        type: 'integer',
        description: 'Filter where age is greater than this value',
      },
      age_gte: {
        type: 'integer',
        description: 'Filter where age is greater than or equal to this value',
      },
      age_eq: {
        type: 'integer',
        description: 'Filter where age equals this value',
      },
      age_ne: {
        type: 'integer',
        description: 'Filter where age does not equal this value',
      },
      age_in: {
        type: 'string',
        description:
          'Filter where age is one of the provided comma-separated values',
      },
      age_not_in: {
        type: 'string',
        description:
          'Filter where age is not one of the provided comma-separated values',
      },
    };
    expect(buildFilterQueryProperties('age', field)).toEqual(expectedSchema);
  });

  // test cases for buildPostBodyValidationSchema
  test('should build post body validation schema', () => {
    const model: ModelConfig = {
      fields: {
        id: {type: 'integer', primaryKey: true},
        name: {type: 'string'},
        email: {type: 'string'},
        age: {type: 'integer', nullable: true},
      },
    };
    const expectedSchema = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'Value for id',
        },
        name: {
          type: 'string',
          description: 'Value for name',
        },
        email: {
          type: 'string',
          description: 'Value for email',
        },
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
      required: ['id', 'name', 'email'],
      additionalProperties: false,
    };
    expect(generateJSONValidationSchema(model)).toEqual(expectedSchema);
  });

  test('should build post body validation schema ignoring primary key', () => {
    const model: ModelConfig = {
      fields: {
        id: {type: 'integer', primaryKey: true},
        name: {type: 'string'},
        email: {type: 'string'},
        age: {type: 'integer', nullable: true},
      },
    };
    const expectedSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Value for name',
        },
        email: {
          type: 'string',
          description: 'Value for email',
        },
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
      required: ['name', 'email'],
      additionalProperties: false,
    };
    expect(
      generateJSONValidationSchema(model, {ignorePrimaryKey: true}),
    ).toEqual(expectedSchema);
  });

  test('should build post body validation schema', () => {
    const model: ModelConfig = {
      fields: {
        id: {type: 'integer', primaryKey: true},
        name: {type: 'string'},
        email: {type: 'string'},
        age: {type: 'integer', nullable: true},
      },
      validation: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Value for id',
          },
          name: {
            type: 'string',
            description: 'Value for name',
          },
          email: {
            type: 'string',
            description: 'Value for email',
          },
          age: {
            type: 'integer',
            description: 'Value for age',
          },
          createdAt: {
            type: 'datetime',
            description: 'Value for createdAt',
          },
          updatedAt: {
            type: 'date-time',
            description: 'Value for updatedAt',
          },
        },
        required: ['id', 'name', 'email'],
      },
    };
    const expectedSchema = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'Value for id',
        },
        name: {
          type: 'string',
          description: 'Value for name',
        },
        email: {
          type: 'string',
          description: 'Value for email',
        },
        age: {
          type: 'integer',
          description: 'Value for age',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Value for createdAt',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Value for updatedAt',
        },
      },
      required: ['id', 'name', 'email'],
    };
    expect(generateJSONValidationSchema(model)).toEqual(expectedSchema);
  });

  test('should build post body validation schmea without and requird fields', () => {
    const model: ModelConfig = {
      fields: {age: {type: 'integer', nullable: true}},
    };
    const expectedSchema = {
      type: 'object',
      properties: {
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
      additionalProperties: false,
    };

    expect(generateJSONValidationSchema(model)).toEqual(expectedSchema);
  });

  // test cases for stripAdditionalPostFields
  test('should strip additional post fields', () => {
    const model: ModelConfig = {
      fields: {
        id: {type: 'integer', primaryKey: true},
        name: {type: 'string'},
        email: {type: 'string'},
        age: {type: 'integer', nullable: true},
      },
    };
    const body = {
      id: 1,
      name: 'test',
      email: 'test',
      age: 20,
      createdAt: '2022-01-01',
      updatedAt: '2022-01-01',
    };
    const expectedBody = {
      id: 1,
      name: 'test',
      email: 'test',
      age: 20,
    };
    expect(stripAdditionalPostFields(model, body)).toEqual(expectedBody);
  });

  // test cases for getResponseStructureSchema
  test('should get response structure schema', () => {
    const codes = [200, 201, 204];
    const dataSchema = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'Value for id',
        },
        name: {
          type: 'string',
          description: 'Value for name',
        },
        email: {
          type: 'string',
          description: 'Value for email',
        },
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
      required: ['id', 'name', 'email'],
    };
    const rowSchema = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'Value for id',
        },
        name: {
          type: 'string',
          description: 'Value for name',
        },
        email: {
          type: 'string',
          description: 'Value for email',
        },
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
      required: ['id', 'name', 'email'],
    };
    const expectedSchema = {
      200: {
        type: 'object',
        properties: {
          code: {type: 'integer'},
          message: {type: 'string'},
          data: dataSchema,
          raw_data: {
            type: 'object',
            properties: {
              changes: {type: 'integer'},
              rows: {
                type: 'array',
                items: rowSchema,
              },
            },
          },
        },
      },
      201: {
        type: 'object',
        properties: {
          code: {type: 'integer'},
          message: {type: 'string'},
          data: dataSchema,
          raw_data: {
            type: 'object',
            properties: {
              changes: {type: 'integer'},
              rows: {
                type: 'array',
                items: rowSchema,
              },
            },
          },
        },
      },
      204: {
        type: 'null',
        description: 'Successfully deleted the entry',
      },
    };
    expect(getResponseStructureSchema(codes, dataSchema, rowSchema)).toEqual(
      expectedSchema,
    );
  });

  test('should throw error for unsupported HTTP status code', () => {
    const codes = [999];
    const dataSchema = {};
    const rowSchema = {};
    expect(() =>
      getResponseStructureSchema(codes, dataSchema, rowSchema),
    ).toThrow('Unsupported HTTP status code: 999');
  });

  test('run getResponseStructureSchema with no rowSchema', () => {
    const codes = [200];
    const dataSchema = {};
    const expectedSchema = {
      200: {
        type: 'object',
        properties: {
          code: {type: 'integer'},
          message: {type: 'string'},
          data: dataSchema,
          raw_data: {
            type: 'object',
            properties: {
              changes: {type: 'integer'},
              rows: {
                type: 'array',
                items: {type: 'object', additionalProperties: true},
              },
            },
          },
        },
      },
    };
    expect(getResponseStructureSchema(codes, dataSchema)).toEqual(
      expectedSchema,
    );
  });

  // test cases for buildSecurityArray
  const baseConfig: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {
        engine: 'postgres',
        connection: {url: 'postgresql://localhost:5432/test'},
      },
    },
    data: {models: {}},
  };

  const upAuthUserModel = {
    model: 'user',
    idField: 'id',
    usernameField: 'email',
    passwordField: 'password',
  };

  test('should return empty array when authentication is disabled', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: false,
        provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
      },
    };
    expect(buildSecurityArray(config, true)).toEqual([]);
  });

  test('should return empty array when authentication is disabled and authorization is false', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: false,
        provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
      },
    };
    expect(buildSecurityArray(config, false)).toEqual([]);
  });

  test('should return bearerAuth when provider is up-auth and authorization is true', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: true,
        provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
      },
    };
    expect(buildSecurityArray(config, true)).toEqual([{bearerAuth: []}]);
  });

  test('should return apiKeyAuth when provider is api-key and authorization is true', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'test-key'}},
      },
    };
    expect(buildSecurityArray(config, true)).toEqual([{apiKeyAuth: []}]);
  });

  test('should return empty array when authorization is false even if auth is enabled', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: true,
        provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
      },
    };
    expect(buildSecurityArray(config, false)).toEqual([]);
  });

  test('should return empty array when authorization is false with api-key provider', () => {
    const config: AppConfig = {
      ...baseConfig,
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'test-key'}},
      },
    };
    expect(buildSecurityArray(config, false)).toEqual([]);
  });

  // test cases for applyFilters
  test('applyFilters should skip keys that do not match any suffix', () => {
    const result = applyFilters({unknown_field: 'val'}, 1);
    expect(result.whereClauses).toEqual([]);
    expect(result.values).toEqual([]);
    expect(result.nextParamIndex).toBe(1);
  });

  test('applyFilters should skip ignore keys', () => {
    const result = applyFilters({page: '1', limit: '20', q: 'search'}, 1);
    expect(result.whereClauses).toEqual([]);
    expect(result.values).toEqual([]);
    expect(result.nextParamIndex).toBe(1);
  });

  test('applyFilters should use extraIgnoreKeys', () => {
    const result = applyFilters({name_eq: 'foo', extra_ignore: 'bar'}, 1, [
      'extra_ignore',
    ]);
    expect(result.whereClauses).toEqual(['"name" = $1']);
    expect(result.values).toEqual(['foo']);
    expect(result.nextParamIndex).toBe(2);
  });

  test('applyFilters should handle _in with empty string values', () => {
    const result = applyFilters({age_in: '1,,3'}, 1);
    expect(result.whereClauses).toEqual(['"age" IN ($1, $2, $3)']);
    expect(result.values).toEqual([1, '', 3]);
    expect(result.nextParamIndex).toBe(4);
  });

  test('applyFilters should handle _in with non-numeric values', () => {
    const result = applyFilters({age_in: 'abc,def'}, 1);
    expect(result.whereClauses).toEqual(['"age" IN ($1, $2)']);
    expect(result.values).toEqual(['abc', 'def']);
    expect(result.nextParamIndex).toBe(3);
  });

  test('applyFilters should handle all filter suffixes', () => {
    const result = applyFilters(
      {
        age_eq: '25',
        age_ne: '99',
        age_lt: '30',
        age_lte: '30',
        age_gt: '20',
        age_gte: '20',
        age_in: '1,2,3',
        age_not_in: '10,20,30',
      },
      1,
    );
    expect(result.whereClauses).toEqual([
      '"age" = $1',
      '"age" != $2',
      '"age" < $3',
      '"age" <= $4',
      '"age" > $5',
      '"age" >= $6',
      '"age" IN ($7, $8, $9)',
      '"age" NOT IN ($10, $11, $12)',
    ]);
    expect(result.values).toEqual([
      '25',
      '99',
      '30',
      '30',
      '20',
      '20',
      1,
      2,
      3,
      10,
      20,
      30,
    ]);
    expect(result.nextParamIndex).toBe(13);
  });

  // test generateJSONValidationSchema with additionalProperties: true
  test('should build validation schema with additionalProperties: true', () => {
    const model: ModelConfig = {
      fields: {name: {type: 'string'}},
    };
    const result = generateJSONValidationSchema(model, {
      additionalProperties: true,
    });
    expect(result.additionalProperties).toBe(true);
  });

  // test normalizeSchemaForAjv with type: 'date'
  test('should normalize date type in validation schema', () => {
    const model: ModelConfig = {
      fields: {birthday: {type: 'date'}},
      validation: {
        type: 'object',
        properties: {
          birthday: {type: 'date', description: 'Value for birthday'},
        },
      },
    };
    const result = generateJSONValidationSchema(model);
    expect((result.properties as Record<string, object>).birthday).toEqual({
      type: 'string',
      format: 'date',
      description: 'Value for birthday',
    });
  });

  // test normalizeSchemaForAjv with no properties
  test('should handle validation schema without properties', () => {
    const model: ModelConfig = {
      fields: {name: {type: 'string'}},
      validation: {type: 'object'},
    };
    const result = generateJSONValidationSchema(model);
    expect(result).toEqual({type: 'object'});
  });
});

// ---------------------------------------------------------------------------
// Tests for buildPreValidation
// ---------------------------------------------------------------------------
describe('buildPreValidation', () => {
  const buildMockApp = (overrides: Record<string, unknown> = {}) => ({
    buildResponse: vi.fn((code: number, message: string, data: unknown) => ({
      code,
      message,
      data,
    })),
    enforceSSP: vi.fn(),
    ...overrides,
  });

  const buildMockRequest = (overrides: Record<string, unknown> = {}) => {
    const authenticate = vi.fn().mockResolvedValue(undefined);
    return {authenticate, ...overrides};
  };

  const buildMockReply = (overrides: Record<string, unknown> = {}) => {
    const status = vi.fn().mockReturnThis();
    const send = vi.fn().mockReturnThis();
    return {status, send, ...overrides};
  };

  const baseAppConfig: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {
        engine: 'postgres',
        connection: {url: 'postgresql://localhost:5432/test'},
      },
    },
    data: {models: {}},
  };

  const authEnabledConfig: AppConfig = {
    ...baseAppConfig,
    authentication: {
      enabled: true,
      provider: {
        type: 'up-auth',
        config: {
          userModel: {
            model: 'user',
            idField: 'id',
            usernameField: 'email',
            passwordField: 'password',
          },
        },
      },
    },
  };

  const authDisabledConfig: AppConfig = {
    ...baseAppConfig,
    authentication: {
      enabled: false,
      provider: {
        type: 'up-auth',
        config: {
          userModel: {
            model: 'user',
            idField: 'id',
            usernameField: 'email',
            passwordField: 'password',
          },
        },
      },
    },
  };

  // --- default checks: ['auth', 'ssp'] ---

  test('auth+ssp: calls authenticate and enforceSSP when auth succeeds', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(app.enforceSSP).toHaveBeenCalledWith(request);
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('auth+ssp: returns 401 and skips enforceSSP when auth fails', async () => {
    const app = buildMockApp();
    const request = buildMockRequest({
      authenticate: vi.fn().mockRejectedValue(new Error('bad token')),
    });
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      app.buildResponse(401, 'Invalid or expired authentication token', null),
    );
    expect(app.enforceSSP).not.toHaveBeenCalled();
  });

  test('auth+ssp: skips auth when auth is disabled, calls enforceSSP', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authDisabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
    expect(app.enforceSSP).toHaveBeenCalledWith(request);
  });

  test('auth+ssp: skips auth when authorization is false, calls enforceSSP', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, false);
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
    expect(app.enforceSSP).toHaveBeenCalledWith(request);
  });

  // --- single checks ---

  test('auth only: calls authenticate but not enforceSSP', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true, [
      'auth',
    ]);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(app.enforceSSP).not.toHaveBeenCalled();
  });

  test('ssp only: skips auth, calls enforceSSP', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true, [
      'ssp',
    ]);
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
    expect(app.enforceSSP).toHaveBeenCalledWith(request);
  });

  test('default checks should be auth+ssp', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(app.enforceSSP).toHaveBeenCalledWith(request);
  });

  test('auth fails with 401 when api-key provider is used', async () => {
    const apiKeyConfig: AppConfig = {
      ...baseAppConfig,
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'test-key'}},
      },
    };
    const app = buildMockApp();
    const request = buildMockRequest({
      authenticate: vi.fn().mockRejectedValue(new Error('bad key')),
    });
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, apiKeyConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(app.enforceSSP).not.toHaveBeenCalled();
  });
});
