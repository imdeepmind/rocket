import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { AppConfig } from '../schema/config';

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all', // removes unknown fields
  useDefaults: true, // fills default values
  coerceTypes: true, // "123" -> 123 (optional)
  strict: true, // strict schema validation
});

addFormats(ajv);

const swaggerSchema = {
  type: 'object',
  required: ['enabled', 'basePath', 'info'],
  additionalProperties: false,

  properties: {
    enabled: { type: 'boolean' },
    basePath: {
      type: 'string',
      pattern: '^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$',
    },
    info: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 5 },
        description: { type: 'string', minLength: 25 },
        version: { type: 'string' },
        termsOfService: {
          type: 'string',
          format: 'uri',
        },
        contact: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            url: {
              type: 'string',
              format: 'uri',
            },
            email: {
              type: 'string',
              format: 'email',
            },
          },
        },
        license: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            url: {
              type: 'string',
              format: 'uri',
            },
          },
        },
      },
    },
  },
};

const databaseSchema = {
  type: 'object',
  oneOf: [
    {
      properties: {
        engine: { type: 'string', const: 'sqlite' },
        connection: {
          type: 'object',
          properties: {
            urlOrPath: {
              type: 'string',
              pattern: '^(.\\/|\\/)?([\\w\\-. ]+\\/)*[\\w\\-. ]+\\.(db|sqlite)$',
            },
          },
          required: ['urlOrPath'],
          additionalProperties: false,
        },
      },
      required: ['engine', 'connection'],
      additionalProperties: false,
    },
    {
      properties: {
        engine: { type: 'string', const: 'pg' },
        connection: {
          type: 'object',
          properties: {
            urlOrPath: { type: 'string', pattern: '^postgres(ql)?:\\/\\/' },
          },
          required: ['urlOrPath'],
          additionalProperties: false,
        },
      },
      required: ['engine', 'connection'],
      additionalProperties: false,
    },
  ],
};

const schema = {
  type: 'object',
  required: ['swagger', 'database'],
  additionalProperties: false,

  properties: {
    swagger: swaggerSchema,
    database: databaseSchema,
  },
};

const validateSchema = ajv.compile(schema);

export function validateConfig(input: AppConfig) {
  const valid = validateSchema(input);

  if (!valid) {
    throw new Error(validateSchema.errors?.map((e) => `${e.instancePath} ${e.message}`).join('\n'));
  }

  return input;
}
