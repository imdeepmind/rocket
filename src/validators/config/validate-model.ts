import Ajv from 'ajv';

import {
  AppConfig,
  JsonSchemaObject,
  JsonSchemaProperty,
} from '@/interfaces/config';

import {normalizeSchemaForAjv} from '@/utils/schema';

const ALLOWED_APIS: Record<string, string[]> = {
  integer: ['edit', 'delete', 'index'],
  decimal: ['edit', 'delete', 'index'],
  string: ['search', 'edit', 'delete', 'index'],
  boolean: [],
  text: [],
  datetime: [],
  date: [],
  json: [],
  enum: ['edit', 'delete', 'index'],
};

const ALLOWED_QUERY: Record<string, string[]> = {
  integer: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
  decimal: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
  string: ['sort', 'eq', 'ne', 'in', 'not_in'],
  boolean: ['eq', 'ne'],
  text: [],
  datetime: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
  date: ['sort', 'lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
  json: [],
  enum: ['eq', 'ne', 'in', 'not_in'],
};

const ALLOWED_AGGREGATIONS: Record<string, string[]> = {
  integer: ['avg', 'max', 'min', 'count', 'sum'],
  decimal: ['avg', 'max', 'min', 'count', 'sum'],
  string: ['count'],
  boolean: ['count', 'frequency'],
  text: [],
  datetime: ['avg', 'max', 'min', 'count'],
  date: ['avg', 'max', 'min', 'count'],
  json: [],
  enum: ['count', 'frequency'],
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
    case 'json':
      return 'object';
    case 'enum':
      return 'string';
    /* istanbul ignore next */
    default:
      return 'string';
  }
}

function validateFieldConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  Object.entries(config.data.models).forEach(([modelName, model]) => {
    Object.entries(model.fields).forEach(([fieldName, field]) => {
      const path = `/data/models/${modelName}/fields/${fieldName}`;
      const {
        type,
        primaryKey,
        autoIncrement,
        apis,
        query,
        aggregations,
        values,
      } = field;

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

      // Validate enum values
      if (type === 'enum') {
        if (!values || values.length === 0) {
          errors.push(`${path}: values is required for enum type`);
        }
      }

      // Validate apis against allowed list for this type
      if (apis) {
        const allowed = ALLOWED_APIS[type]!;
        apis.forEach(op => {
          if (!allowed.includes(op)) {
            errors.push(
              `${path}/apis: "${op}" is not allowed for type "${type}"`,
            );
          }
        });
      }

      // Validate query against allowed list for this type
      if (query) {
        const allowed = ALLOWED_QUERY[type]!;
        query.forEach(op => {
          if (!allowed.includes(op)) {
            errors.push(
              `${path}/query: "${op}" is not allowed for type "${type}"`,
            );
          }
        });
      }

      // Validate aggregations against allowed list for this type
      if (aggregations) {
        const allowed = ALLOWED_AGGREGATIONS[type]!;
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
      const schemaErrors = ajv.errors!.map(
        e => `${path}: ${e.instancePath} ${e.message}`,
      );
      errors.push(...schemaErrors);
    }

    const fieldMap = new Map(
      Object.keys(model.fields).map(name => [name, model.fields[name].type]),
    );

    // properties validation
    if (schema.properties) {
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

          if (!isDateMatch) {
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
