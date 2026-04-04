import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { AppConfig } from '../schema/config';

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all',
  useDefaults: true,
  coerceTypes: true,
  strict: true,
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
        termsOfService: { type: 'string', format: 'uri' },
        contact: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            email: { type: 'string', format: 'email' },
          },
        },
        license: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
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

const fieldSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'type'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    },
    type: {
      type: 'string',
      enum: ['integer', 'string', 'boolean', 'text', 'datetime'],
    },
    primaryKey: { type: 'boolean', default: false },
    nullable: { type: 'boolean', default: true },
    unique: { type: 'boolean', default: false },
    default: true,
    supportedOperations: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    },
    supportedAggregation: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    },
  },
};

const modelSchema = {
  type: 'object',
  required: ['name', 'fields'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      minLength: 1,
    },
    fields: {
      type: 'array',
      minItems: 1,
      items: fieldSchema,
    },
  },
};

const schema = {
  type: 'object',
  required: ['swagger', 'database', 'models'],
  additionalProperties: false,
  properties: {
    swagger: swaggerSchema,
    database: databaseSchema,
    models: {
      type: 'array',
      minItems: 1,
      items: modelSchema,
    },
  },
};

const ALLOWED_OPERATIONS: Record<string, string[]> = {
  integer: [
    'sortable',
    'editable',
    'deletable',
    'lessThan',
    'lessThanEqual',
    'greaterThan',
    'greaterThanEqual',
    'equal',
    'oneOf',
    'indexable',
  ],
  string: ['searchable', 'sortable', 'editable', 'deletable', 'equal', 'oneOf', 'indexable'],
  boolean: ['equal'],
  text: [],
  datetime: [
    'sortable',
    'lessThan',
    'lessThanEqual',
    'greaterThan',
    'greaterThanEqual',
    'equal',
    'oneOf',
  ],
};

const ALLOWED_AGGREGATIONS: Record<string, string[]> = {
  integer: ['mean', 'max', 'min', 'count', 'sum'],
  string: ['count'],
  boolean: ['count', 'frequency'],
  text: [],
  datetime: ['mean', 'max', 'min', 'count'],
};

function validateFieldConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    model.fields.forEach((field, fi) => {
      const path = `/models/${mi}/fields/${fi}`;
      const { type, primaryKey, nullable, unique, supportedOperations, supportedAggregation } =
        field;

      // Primary key rules
      if (primaryKey) {
        if (nullable !== false) errors.push(`${path}: primaryKey field must have nullable=false`);
        if (unique !== true) errors.push(`${path}: primaryKey field must have unique=true`);
      }

      // Validate supportedOperations against allowed list for this type
      if (supportedOperations) {
        const allowed = ALLOWED_OPERATIONS[type] ?? [];
        supportedOperations.forEach((op) => {
          if (!allowed.includes(op)) {
            errors.push(`${path}/supportedOperations: "${op}" is not allowed for type "${type}"`);
          }
        });
      }

      // Validate supportedAggregation against allowed list for this type
      if (supportedAggregation) {
        const allowed = ALLOWED_AGGREGATIONS[type] ?? [];
        supportedAggregation.forEach((agg) => {
          if (!allowed.includes(agg)) {
            errors.push(`${path}/supportedAggregation: "${agg}" is not allowed for type "${type}"`);
          }
        });
      }
    });
  });

  return errors;
}

const validateSchema = ajv.compile(schema);

export function validateConfig(input: AppConfig) {
  const valid = validateSchema(input);

  const ajvErrors: string[] = valid
    ? []
    : (validateSchema.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? []);

  // Only run field constraint checks if AJV structural validation passed,
  // otherwise the fields may not be fully formed yet.
  const constraintErrors = valid ? validateFieldConstraints(input as AppConfig) : [];

  const allErrors = [...ajvErrors, ...constraintErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'));
  }

  return input;
}
