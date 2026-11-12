import {expect, test} from 'vitest';

import {
  generateJSONValidationSchema,
  stripAdditionalPostFields,
} from '@/lib/schema/body';

import {ModelConfig} from '@/interfaces/config';

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
  expect(generateJSONValidationSchema(model, {ignorePrimaryKey: true})).toEqual(
    expectedSchema,
  );
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

// test generateJSONValidationSchema with enum field
test('should generate body schema with enum values', () => {
  const model: ModelConfig = {
    fields: {
      status: {type: 'enum', values: ['active', 'inactive']},
    },
  };
  const result = generateJSONValidationSchema(model);
  expect(result.properties).toEqual({
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
      description: 'Value for status',
    },
  });
});

// test excludeTimestamps option
test('should exclude managed timestamp fields when excludeTimestamps is true', () => {
  const model: ModelConfig = {
    fields: {
      id: {type: 'integer', primaryKey: true},
      name: {type: 'string'},
      created_at: {type: 'datetime', nullable: false},
      updated_at: {type: 'datetime', nullable: false},
    },
  };
  const result = generateJSONValidationSchema(model, {
    excludeTimestamps: true,
  }) as {properties: Record<string, unknown>; required?: string[]};

  expect(result.properties).not.toHaveProperty('created_at');
  expect(result.properties).not.toHaveProperty('updated_at');
  expect(result.properties).toHaveProperty('name');
  expect(result.required).toEqual(['id', 'name']);
});

test('should strip managed timestamp fields from validation schema when excludeTimestamps is true', () => {
  const model: ModelConfig = {
    fields: {name: {type: 'string'}},
    validation: {
      type: 'object',
      properties: {
        name: {type: 'string'},
        created_at: {type: 'datetime'},
        updated_at: {type: 'date-time'},
      },
      required: ['name', 'created_at', 'updated_at'],
    },
  };
  const result = generateJSONValidationSchema(model, {
    excludeTimestamps: true,
  }) as {properties: Record<string, unknown>; required?: string[]};

  expect(result.properties).not.toHaveProperty('created_at');
  expect(result.properties).not.toHaveProperty('updated_at');
  expect(result.properties).toHaveProperty('name');
  expect(result.required).toEqual(['name']);
});

test('should not require properties or required when stripping managed timestamps from validation schema', () => {
  const model: ModelConfig = {
    fields: {name: {type: 'string'}},
    validation: {
      type: 'object',
    },
  };
  const result = generateJSONValidationSchema(model, {
    excludeTimestamps: true,
  });

  expect(result).toEqual({type: 'object'});
});

// test stripAdditionalPostFields excludes managed timestamp fields
test('should strip managed timestamp fields from the body', () => {
  const model: ModelConfig = {
    fields: {
      id: {type: 'integer', primaryKey: true},
      name: {type: 'string'},
      created_at: {type: 'datetime'},
      updated_at: {type: 'datetime'},
    },
  };
  const body = {
    id: 1,
    name: 'test',
    created_at: '2022-01-01',
    updated_at: '2022-01-01',
  };
  const expectedBody = {
    id: 1,
    name: 'test',
  };
  expect(stripAdditionalPostFields(model, body)).toEqual(expectedBody);
});
