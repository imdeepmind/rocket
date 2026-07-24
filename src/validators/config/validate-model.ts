import Ajv from 'ajv';

import {
  AppConfig,
  JsonSchemaObject,
  JsonSchemaProperty,
} from '@/interfaces/config';

const ALLOWED_OPERATIONS: Record<string, string[]> = {
  integer: [
    'sort',
    'lt',
    'lte',
    'gt',
    'gte',
    'eq',
    'in',
    'edit',
    'delete',
    'index',
  ],
  decimal: [
    'sort',
    'lt',
    'lte',
    'gt',
    'gte',
    'eq',
    'in',
    'edit',
    'delete',
    'index',
  ],
  string: ['search', 'sort', 'eq', 'in', 'edit', 'delete', 'index'],
  boolean: ['eq'],
  text: [],
  datetime: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'in'],
  date: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'in'],
};

const ALLOWED_AGGREGATIONS: Record<string, string[]> = {
  integer: ['avg', 'max', 'min', 'count', 'sum'],
  decimal: ['avg', 'max', 'min', 'count', 'sum'],
  string: ['count'],
  boolean: ['count', 'frequency'],
  text: [],
  datetime: ['avg', 'max', 'min', 'count'],
  date: ['avg', 'max', 'min', 'count'],
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

  Object.entries(config.data.models).forEach(([modelName, model]) => {
    Object.entries(model.fields).forEach(([fieldName, field]) => {
      const path = `/data/models/${modelName}/fields/${fieldName}`;
      const {type, primaryKey, autoIncrement, operations, aggregations} = field;

      // Primary key rules
      if (primaryKey) {
        if (type !== 'integer' && type !== 'string') {
          errors.push(
            `${path}: primaryKey field must be of type integer or string (found ${type})`,
          );
        }

        if (autoIncrement && type !== 'integer') {
          errors.push(
            `${path}: autoIncrement is only allowed on integer primaryKey fields`,
          );
        }
      }

      if (autoIncrement && !primaryKey) {
        errors.push(
          `${path}: autoIncrement is only allowed on primaryKey fields`,
        );
      }

      // Validate operations against allowed list for this type
      if (operations) {
        const allowed = ALLOWED_OPERATIONS[type] ?? [];
        operations.forEach(op => {
          if (!allowed.includes(op)) {
            errors.push(
              `${path}/operations: "${op}" is not allowed for type "${type}"`,
            );
          }
        });
      }

      // Validate aggregations against allowed list for this type
      if (aggregations) {
        const allowed = ALLOWED_AGGREGATIONS[type] ?? [];
        aggregations.forEach(agg => {
          if (!allowed.includes(agg)) {
            errors.push(
              `${path}/aggregations: "${agg}" is not allowed for type "${type}"`,
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

  Object.entries(config.data.models).forEach(([modelName, model]) => {
    const validation = (model as {validation?: unknown}).validation;
    if (!validation) return;

    const path = `/data/models/${modelName}/validation`;

    const schema = validation as JsonSchemaObject;

    // validate JSON schema
    const normalizedSchema = normalizeSchemaForAjv(schema);
    const isValidSchema = ajv.validateSchema(normalizedSchema);
    if (!isValidSchema) {
      const schemaErrors =
        ajv.errors?.map(e => `${path}: ${e.instancePath} ${e.message}`) ?? [];
      errors.push(...schemaErrors);
    }

    const fieldMap = new Map(
      Object.keys(model.fields).map(name => [name, model.fields[name].type]),
    );

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
