import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { AppConfig, JsonSchemaObject, JsonSchemaProperty } from '../schema/config';

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
            name: { type: 'string', minLength: 5 },
            url: { type: 'string', format: 'uri' },
            email: { type: 'string', format: 'email' },
          },
        },
        license: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1 },
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

const indexSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'columns'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    },
    columns: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      },
      uniqueItems: true,
    },
    unique: {
      type: 'boolean',
      default: false,
    },
  },
};

const foreignKeySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'columns', 'referenceTable', 'referenceColumns'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    },
    columns: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      uniqueItems: true,
    },
    referenceTable: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    },
    referenceColumns: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      uniqueItems: true,
    },
    onDelete: {
      type: 'string',
      enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'],
    },
    onUpdate: {
      type: 'string',
      enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'],
    },
  },
};

const modelSchema = {
  type: 'object',
  required: ['name', 'fields', 'indexes', 'foreignKeys'],
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
    indexes: {
      type: 'array',
      items: indexSchema,
      default: [],
    },
    foreignKeys: {
      type: 'array',
      items: foreignKeySchema,
      default: [],
    },
    validation: {
      type: 'object',
      nullable: true,
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
        if (type !== 'integer' && type !== 'string') {
          errors.push(
            `${path}: primaryKey field must be of type integer or string (found ${type})`
          );
        }
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

function validateIndexes(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.indexes) return;

    const indexNames = new Set<string>();
    const fieldNames = new Set(model.fields.map((f) => f.name));

    model.indexes.forEach((index, ii) => {
      const indexPath = `${path}/indexes/${ii}`;

      // 1. unique index name
      if (indexNames.has(index.name)) {
        errors.push(`${indexPath}: duplicate index name "${index.name}"`);
      } else {
        indexNames.add(index.name);
      }

      // 2. columns must exist
      index.columns.forEach((col) => {
        if (!fieldNames.has(col)) {
          errors.push(`${indexPath}/columns: column "${col}" does not exist in fields`);
        }
      });
    });
  });

  return errors;
}

function validateForeignKeys(config: AppConfig): string[] {
  const errors: string[] = [];

  // Map of all models for quick lookup
  const modelMap = new Map<string, (typeof config.models)[0]>();
  config.models.forEach((m) => modelMap.set(m.name, m));

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.foreignKeys) return;

    const fieldNames = new Set(model.fields.map((f) => f.name));
    const fkNames = new Set<string>();

    model.foreignKeys.forEach((fk, fi) => {
      const fkPath = `${path}/foreignKeys/${fi}`;

      // 1. unique FK name inside model
      if (fkNames.has(fk.name)) {
        errors.push(`${fkPath}: duplicate foreign key name "${fk.name}"`);
      } else {
        fkNames.add(fk.name);
      }

      // 2. local columns must exist
      fk.columns.forEach((col) => {
        if (!fieldNames.has(col)) {
          errors.push(`${fkPath}/columns: column "${col}" does not exist in model "${model.name}"`);
        }
      });

      // 3. reference table must exist
      const refModel = modelMap.get(fk.referenceTable);
      if (!refModel) {
        errors.push(`${fkPath}: referenceTable "${fk.referenceTable}" does not exist`);
        return;
      }

      const refFieldNames = new Set(refModel.fields.map((f) => f.name));

      // 4. reference columns must exist
      fk.referenceColumns.forEach((col) => {
        if (!refFieldNames.has(col)) {
          errors.push(
            `${fkPath}/referenceColumns: column "${col}" does not exist in table "${fk.referenceTable}"`
          );
        }
      });

      // 5. column length match (VERY important)
      if (fk.columns.length !== fk.referenceColumns.length) {
        errors.push(`${fkPath}: columns and referenceColumns must have same length`);
      }
    });
  });

  return errors;
}

function mapModelTypeToJsonSchema(type: string): string {
  switch (type) {
    case 'integer':
      return 'integer';
    case 'string':
    case 'text':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'datetime':
      return 'string';
    default:
      return 'string';
  }
}

function validateModelValidation(config: AppConfig, ajv: Ajv): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const validation = (model as { validation?: unknown }).validation;
    if (!validation) return;

    const path = `/models/${mi}/validation`;

    // must be object
    if (typeof validation !== 'object' || validation === null || Array.isArray(validation)) {
      errors.push(`${path}: must be an object`);
      return;
    }

    const schema = validation as JsonSchemaObject;

    // validate JSON schema
    const isValidSchema = ajv.validateSchema(schema);
    if (!isValidSchema) {
      const schemaErrors = ajv.errors?.map((e) => `${path}: ${e.instancePath} ${e.message}`) ?? [];
      errors.push(...schemaErrors);
    }

    const fieldMap = new Map(model.fields.map((f) => [f.name, f.type]));

    // properties validation
    if (schema.properties && typeof schema.properties === 'object') {
      Object.entries(schema.properties).forEach(([key, value]) => {
        const propPath = `${path}/properties/${key}`;

        if (!fieldMap.has(key)) {
          errors.push(`${propPath}: field does not exist in model`);
          return;
        }

        const modelType = fieldMap.get(key)!;
        const expectedType = mapModelTypeToJsonSchema(modelType);

        let schemaType: string | undefined;

        if (typeof value === 'object' && value !== null && 'type' in value) {
          const v = value as JsonSchemaProperty;
          schemaType = v.type;
        }

        if (schemaType && schemaType !== expectedType) {
          errors.push(`${propPath}: type mismatch (model=${modelType}, schema=${schemaType})`);
        }
      });
    }

    // required validation
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) {
        errors.push(`${path}/required: must be an array`);
      } else {
        schema.required.forEach((field, idx) => {
          if (!fieldMap.has(field)) {
            errors.push(`${path}/required/${idx}: field "${field}" does not exist in model`);
          }
        });
      }
    }
  });

  return errors;
}
const validateSchema = ajv.compile(schema);

export function validateConfig(input: AppConfig) {
  const valid = validateSchema(input);

  const ajvErrors: string[] = valid
    ? []
    : (validateSchema.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? []);

  const constraintErrors = valid
    ? [
        ...validateFieldConstraints(input as AppConfig),
        ...validateIndexes(input as AppConfig),
        ...validateForeignKeys(input as AppConfig),
        ...validateModelValidation(input as AppConfig, ajv),
      ]
    : [];

  const allErrors = [...ajvErrors, ...constraintErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'));
  }

  return input;
}
