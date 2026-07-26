import {describe, expect, it, test} from 'vitest';

import {
  buildFilterQueryProperties,
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
      query: ['lt', 'lte', 'gt', 'gte', 'eq', 'in'],
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
      age_in: {
        type: 'string',
        description:
          'Filter where age is one of the provided comma-separated values',
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
});
