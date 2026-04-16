import {
  DataType,
  JsonSchemaObject,
  ModelBody,
  ModelConfig,
  ModelFieldConfig,
} from '@/schema/config';

/**
 * Map config DataType to JSON Schema type definition for Swagger.
 */
export function mapDataTypeToJsonSchema(type: DataType): {
  type: string;
  format?: string;
} {
  switch (type) {
    case 'integer':
      return {type: 'integer'};
    case 'string':
      return {type: 'string'};
    case 'boolean':
      return {type: 'boolean'};
    case 'text':
      return {type: 'string'};
    case 'datetime':
      return {type: 'string', format: 'date-time'};
    default:
      return {type: 'string'};
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
 * Build filter query parameter schema properties for a field
 * based on its supportedOperations (lessThan, greaterThan, equal, oneOf, etc.).
 */
export function buildFilterQueryProperties(
  field: ModelFieldConfig,
): Record<string, object> {
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
 * Normalize the schema for AJV by converting custom types to standard ones.
 */
function normalizeSchemaForAjv(schema: JsonSchemaObject): JsonSchemaObject {
  const normalized = JSON.parse(JSON.stringify(schema));
  if (normalized.properties && typeof normalized.properties === 'object') {
    Object.keys(normalized.properties).forEach(key => {
      const prop = (normalized.properties as Record<string, JsonSchemaObject>)[
        key
      ];
      if (prop && (prop.type === 'datetime' || prop.type === 'date-time')) {
        prop.type = 'string';
        prop.format = 'date-time';
      }
    });
  }
  return normalized;
}

/**
 * Build (or reuse) the JSON schema for a POST body based on the model.
 *
 * Rules for generated schema:
 * - Every field is included in `properties`.
 * - `required` includes fields that are NOT marked `nullable` and have NO `default`.
 * - If `model.validation` is provided, it is used verbatim.
 */
export function buildPostBodyValidationSchema(
  model: ModelConfig,
  options: {ignorePrimaryKey?: boolean} = {},
): Record<string, unknown> {
  if (model.validation) return normalizeSchemaForAjv(model.validation);

  const fields = options.ignorePrimaryKey
    ? model.fields.filter(field => field.primaryKey !== true)
    : model.fields;

  const bodyProperties: Record<string, object> = {};
  for (const field of fields) {
    bodyProperties[field.name] = {
      ...mapDataTypeToJsonSchema(field.type),
      description: `Value for ${field.name}`,
    };
  }

  const required = fields
    .filter(field => field.nullable !== true && field.default === undefined)
    .map(field => field.name);

  return {
    type: 'object',
    properties: bodyProperties,
    ...(required.length > 0 ? {required} : {}),
  };
}

/**
 * Strip any fields from the request body that are not present in the model.
 */
export function stripAdditionalPostFields(
  model: ModelConfig,
  body: ModelBody,
  options: {ignorePrimaryKey?: boolean} = {},
): ModelBody {
  const allowedFields = options.ignorePrimaryKey
    ? model.fields.filter(field => field.primaryKey !== true)
    : model.fields;

  const allowed = new Set(allowedFields.map(field => field.name));
  const filtered: ModelBody = {};

  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

export const getResponseStructureSchema = (
  codes: number[],
  dataSchema: Record<string, unknown>,
  rowSchema?: Record<string, unknown>,
): Record<number, object> => {
  const respSchema: Record<number, object> = {};

  for (const code of codes) {
    switch (code) {
      case 200:
      case 201:
        respSchema[code] = {
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
                  items: rowSchema || {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        };
        break;
      case 204:
        respSchema[code] = {
          type: 'null',
          description: 'Successfully deleted the entry',
        };
        break;
      default:
        throw new Error(`Unsupported HTTP status code: ${code}`);
    }
  }

  return respSchema;
};

/**
 * Common signal and pagination keys to ignore when applying filters.
 */
export const filterIgnoreKeys = [
  'page',
  'limit',
  'orderBy',
  'orderDir',
  'q', // For search
];

/**
 * Shared filter application logic for SQL generation.
 */
export function applyFilters(
  queryParams: Record<string, unknown>,
  startParamIndex: number,
  extraIgnoreKeys: string[] = [],
): {
  whereClauses: string[];
  values: unknown[];
  nextParamIndex: number;
} {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = startParamIndex;

  const allIgnoreKeys = [...filterIgnoreKeys, ...extraIgnoreKeys];

  for (const key of Object.keys(queryParams)) {
    if (allIgnoreKeys.includes(key)) continue;

    if (key.endsWith('_eq')) {
      whereClauses.push(`"${key.replace('_eq', '')}" = $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_lt')) {
      whereClauses.push(`"${key.replace('_lt', '')}" < $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_lte')) {
      whereClauses.push(`"${key.replace('_lte', '')}" <= $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_gt')) {
      whereClauses.push(`"${key.replace('_gt', '')}" > $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_gte')) {
      whereClauses.push(`"${key.replace('_gte', '')}" >= $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_in')) {
      const inValues = String(queryParams[key]).split(',');
      const inParams = inValues.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`"${key.replace('_in', '')}" IN (${inParams})`);
      values.push(...inValues);
    }
  }

  return {whereClauses, values, nextParamIndex: paramIndex};
}
