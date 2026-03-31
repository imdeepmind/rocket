import { DataType, ModelFieldConfig } from '../schema/config';

/**
 * Map config DataType to JSON Schema type definition for Swagger.
 */
export function mapDataTypeToJsonSchema(type: DataType): {
  type: string;
  format?: string;
} {
  switch (type) {
    case 'integer':
      return { type: 'integer' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'text':
      return { type: 'string' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    default:
      return { type: 'string' };
  }
}

/**
 * Standard pagination query parameter schema properties.
 */
export const paginationQueryProperties: Record<string, object> = {
  page: {
    type: 'integer',
    description: 'Page number (1-indexed)',
    default: 1,
  },
  limit: {
    type: 'integer',
    description: 'Number of records per page',
    default: 20,
  },
};

/**
 * Build sort query parameter schema properties for sortable fields.
 */
export function buildSortQueryProperties(sortableFields: string[]): Record<string, object> {
  if (sortableFields.length === 0) return {};
  return {
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
}

/**
 * Build filter query parameter schema properties for a field
 * based on its supportedOperations (lessThan, greaterThan, equal, oneOf, etc.).
 */
export function buildFilterQueryProperties(field: ModelFieldConfig): Record<string, object> {
  const ops = field.supportedOperations || [];
  const jsonType = mapDataTypeToJsonSchema(field.type);
  const properties: Record<string, object> = {};

  if (ops.includes('lessThan')) {
    properties[`${field.name}_lt`] = {
      ...jsonType,
      description: `Filter where ${field.name} is less than this value`,
    };
  }

  if (ops.includes('lessThanEqual')) {
    properties[`${field.name}_lte`] = {
      ...jsonType,
      description: `Filter where ${field.name} is less than or equal to this value`,
    };
  }

  if (ops.includes('greaterThan')) {
    properties[`${field.name}_gt`] = {
      ...jsonType,
      description: `Filter where ${field.name} is greater than this value`,
    };
  }

  if (ops.includes('greaterThanEqual')) {
    properties[`${field.name}_gte`] = {
      ...jsonType,
      description: `Filter where ${field.name} is greater than or equal to this value`,
    };
  }

  if (ops.includes('equal')) {
    properties[`${field.name}_eq`] = {
      ...jsonType,
      description: `Filter where ${field.name} equals this value`,
    };
  }

  if (ops.includes('oneOf')) {
    properties[`${field.name}_in`] = {
      type: 'string',
      description: `Filter where ${field.name} is one of the provided comma-separated values`,
    };
  }

  return properties;
}

/**
 * Standard hello world response schema (placeholder).
 */
export const helloWorldResponseSchema = {
  200: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  },
};

export const getResponseStructureSchema = (
  codes: number[],
  dataSchema: Record<string, unknown>,
  rowSchema?: Record<string, unknown>
): Record<number, object> => {
  const respSchema: Record<number, object> = {};

  for (const code of codes) {
    switch (code) {
      case 201:
        respSchema[code] = {
          type: 'object',
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
            data: dataSchema,
            raw_data: {
              type: 'object',
              properties: {
                changes: { type: 'integer' },
                rows: {
                  type: 'array',
                  items: rowSchema || { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        };
        break;
      default:
        break;
    }
  }

  return respSchema;
};
