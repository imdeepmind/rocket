import Ajv from 'ajv';

import {
  AppConfig,
  JsonSchemaObject,
  JsonSchemaProperty,
} from '@/interfaces/config';

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
  decimal: [
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
  string: [
    'searchable',
    'sortable',
    'editable',
    'deletable',
    'equal',
    'oneOf',
    'indexable',
  ],
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
  date: [
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
  decimal: ['mean', 'max', 'min', 'count', 'sum'],
  string: ['count'],
  boolean: ['count', 'frequency'],
  text: [],
  datetime: ['mean', 'max', 'min', 'count'],
  date: ['mean', 'max', 'min', 'count'],
};

function mapModelTypeToJsonSchema(type: string): string {
  switch (type) {
    case 'integer':
      return 'integer';
    case 'decimal':
      return 'number';
    case 'string':
    case 'text':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'datetime':
      return 'date-time';
    case 'date':
      return 'date';
    /* istanbul ignore next */
    default:
      return 'string';
  }
}

function normalizeSchemaForAjv(schema: JsonSchemaObject): JsonSchemaObject {
  const normalized = JSON.parse(JSON.stringify(schema));
  if (normalized.properties && typeof normalized.properties === 'object') {
    Object.keys(normalized.properties).forEach(key => {
      const prop = (
        normalized.properties as Record<string, JsonSchemaProperty>
      )[key];
      if (prop && (prop.type === 'datetime' || prop.type === 'date-time')) {
        prop.type = 'string';
        prop.format = 'date-time';
      }
      if (prop && prop.type === 'date') {
        prop.type = 'string';
        prop.format = 'date';
      }
    });
  }
  return normalized;
}

function validateFieldConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    model.fields.forEach((field, fi) => {
      const path = `/models/${mi}/fields/${fi}`;
      const {
        type,
        primaryKey,
        nullable,
        unique,
        supportedOperations,
        supportedAggregation,
      } = field;

      // Primary key rules
      if (primaryKey) {
        if (nullable !== false)
          errors.push(`${path}: primaryKey field must have nullable=false`);
        if (unique !== true)
          errors.push(`${path}: primaryKey field must have unique=true`);
        if (type !== 'integer' && type !== 'string') {
          errors.push(
            `${path}: primaryKey field must be of type integer or string (found ${type})`,
          );
        }
      }

      // Validate supportedOperations against allowed list for this type
      if (supportedOperations) {
        const allowed = ALLOWED_OPERATIONS[type] ?? [];
        supportedOperations.forEach(op => {
          if (!allowed.includes(op)) {
            errors.push(
              `${path}/supportedOperations: "${op}" is not allowed for type "${type}"`,
            );
          }
        });
      }

      // Validate supportedAggregation against allowed list for this type
      if (supportedAggregation) {
        const allowed = ALLOWED_AGGREGATIONS[type] ?? [];
        supportedAggregation.forEach(agg => {
          if (!allowed.includes(agg)) {
            errors.push(
              `${path}/supportedAggregation: "${agg}" is not allowed for type "${type}"`,
            );
          }
        });
      }
    });
  });

  return errors;
}

function validateModelValidation(config: AppConfig, ajv: Ajv): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const validation = (model as {validation?: unknown}).validation;
    if (!validation) return;

    const path = `/models/${mi}/validation`;

    const schema = validation as JsonSchemaObject;

    // validate JSON schema
    const normalizedSchema = normalizeSchemaForAjv(schema);
    const isValidSchema = ajv.validateSchema(normalizedSchema);
    if (!isValidSchema) {
      const schemaErrors =
        ajv.errors?.map(e => `${path}: ${e.instancePath} ${e.message}`) ?? [];
      errors.push(...schemaErrors);
    }

    const fieldMap = new Map(model.fields.map(f => [f.name, f.type]));

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
          const isDateMatch =
            (schemaType === 'datetime' || schemaType === 'date-time') &&
            (expectedType === 'datetime' || expectedType === 'date-time');

          const isJustDateMatch =
            schemaType === 'date' && expectedType === 'date';

          if (!isDateMatch && !isJustDateMatch) {
            errors.push(
              `${propPath}: type mismatch (model=${modelType}, schema=${schemaType})`,
            );
          }
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
            errors.push(
              `${path}/required/${idx}: field "${field}" does not exist in model`,
            );
          }
        });
      }
    }
  });

  errors.push(...validateFieldConstraints(config));

  return errors;
}

export default validateModelValidation;
