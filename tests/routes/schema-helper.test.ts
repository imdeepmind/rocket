import {describe, it, test, expect} from 'vitest';
import {
  mapDataTypeToJsonSchema,
  buildSortQueryProperties,
  buildFilterQueryProperties,
  buildPostBodyValidationSchema,
  stripAdditionalPostFields,
  getResponseStructureSchema,
} from '../../src/routes/schema-helpers';
import {DataType, ModelConfig, ModelFieldConfig} from '../../src/schema/config';

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
    const field = {
      name: 'age',
      type: 'integer',
      supportedOperations: [
        'lessThan',
        'lessThanEqual',
        'greaterThan',
        'greaterThanEqual',
        'equal',
        'oneOf',
      ],
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
    expect(buildFilterQueryProperties(field as ModelFieldConfig)).toEqual(
      expectedSchema,
    );
  });

  // test cases for buildPostBodyValidationSchema
  test('should build post body validation schema', () => {
    const model: ModelConfig = {
      name: 'test',
      fields: [
        {name: 'id', type: 'integer', primaryKey: true},
        {name: 'name', type: 'string'},
        {name: 'email', type: 'string'},
        {name: 'age', type: 'integer', nullable: true},
      ],
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
    };
    expect(buildPostBodyValidationSchema(model)).toEqual(expectedSchema);
  });

  test('should build post body validation schema', () => {
    const model: ModelConfig = {
      name: 'test',
      fields: [
        {name: 'id', type: 'integer', primaryKey: true},
        {name: 'name', type: 'string'},
        {name: 'email', type: 'string'},
        {name: 'age', type: 'integer', nullable: true},
      ],
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
    expect(buildPostBodyValidationSchema(model)).toEqual(expectedSchema);
  });

  test('should build post body validation schmea without and requird fields', () => {
    const model: ModelConfig = {
      name: 'test',
      fields: [{name: 'age', type: 'integer', nullable: true}],
    };
    const expectedSchema = {
      type: 'object',
      properties: {
        age: {
          type: 'integer',
          description: 'Value for age',
        },
      },
    };

    expect(buildPostBodyValidationSchema(model)).toEqual(expectedSchema);
  });

  // test cases for stripAdditionalPostFields
  test('should strip additional post fields', () => {
    const model: ModelConfig = {
      name: 'test',
      fields: [
        {name: 'id', type: 'integer', primaryKey: true},
        {name: 'name', type: 'string'},
        {name: 'email', type: 'string'},
        {name: 'age', type: 'integer', nullable: true},
      ],
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
});
