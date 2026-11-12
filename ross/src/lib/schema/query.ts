import {getPublicFields, mapDataTypeToJsonSchema} from '@/lib/schema/types';

import {
  ModelConfig,
  ModelFieldConfig,
  QueryOperation,
} from '@/interfaces/config';

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
    minimum: 10,
    maximum: 100,
  },
};

/**
 * Build sort query parameter schema properties for sortable fields.
 */
export function buildSortQueryProperties(
  sortableFields: string[],
): Record<string, object> {
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
 * Build all query parameter schema properties for a model:
 * filter params, sort params, and pagination params.
 */
export function buildAllQueryProperties(
  model: ModelConfig,
  effectiveQueries?: QueryOperation[],
  bypassSecret?: boolean,
): Record<string, object> {
  const properties: Record<string, object> = {};

  const fields = bypassSecret
    ? Object.entries(model.fields)
    : getPublicFields(model);

  for (const [fName, f] of fields) {
    Object.assign(
      properties,
      buildFilterQueryProperties(fName, f, effectiveQueries),
    );
  }

  const sortableFields = fields
    .filter(([, f]) => {
      if (effectiveQueries && !effectiveQueries.includes('sort')) return false;
      return f.query?.includes('sort');
    })
    .map(([fName]) => fName);
  Object.assign(properties, buildSortQueryProperties(sortableFields));

  Object.assign(properties, paginationQueryProperties);

  return properties;
}

/**
 * Build filter query parameter schema properties for a field
 * based on its query operations (lt, lte, gt, gte, eq, in, etc.).
 */
export function buildFilterQueryProperties(
  fieldName: string,
  field: ModelFieldConfig,
  effectiveQueries?: QueryOperation[],
): Record<string, object> {
  const ops = effectiveQueries
    ? (field.query || []).filter(op => effectiveQueries.includes(op))
    : field.query || [];
  const jsonType = mapDataTypeToJsonSchema(field.type);
  const properties: Record<string, object> = {};

  if (ops.includes('lt')) {
    properties[`${fieldName}_lt`] = {
      ...jsonType,
      description: `Filter where ${fieldName} is less than this value`,
    };
  }

  if (ops.includes('lte')) {
    properties[`${fieldName}_lte`] = {
      ...jsonType,
      description: `Filter where ${fieldName} is less than or equal to this value`,
    };
  }

  if (ops.includes('gt')) {
    properties[`${fieldName}_gt`] = {
      ...jsonType,
      description: `Filter where ${fieldName} is greater than this value`,
    };
  }

  if (ops.includes('gte')) {
    properties[`${fieldName}_gte`] = {
      ...jsonType,
      description: `Filter where ${fieldName} is greater than or equal to this value`,
    };
  }

  if (ops.includes('eq')) {
    properties[`${fieldName}_eq`] = {
      ...jsonType,
      description: `Filter where ${fieldName} equals this value`,
    };
  }

  if (ops.includes('in')) {
    properties[`${fieldName}_in`] = {
      type: 'string',
      description: `Filter where ${fieldName} is one of the provided comma-separated values`,
    };
  }

  if (ops.includes('ne')) {
    properties[`${fieldName}_ne`] = {
      ...jsonType,
      description: `Filter where ${fieldName} does not equal this value`,
    };
  }

  if (ops.includes('not_in')) {
    properties[`${fieldName}_not_in`] = {
      type: 'string',
      description: `Filter where ${fieldName} is not one of the provided comma-separated values`,
    };
  }

  return properties;
}
