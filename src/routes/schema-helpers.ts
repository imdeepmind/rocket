import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  AppConfig,
  DataType,
  ModelBody,
  ModelConfig,
  ModelFieldConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

import {normalizeSchemaForAjv} from '@/utils/schema';

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
    case 'date':
      return {type: 'string', format: 'date'};
    case 'decimal':
      return {type: 'number'};
    case 'json':
      return {type: 'object'};
    case 'enum':
    case 'uuid':
    case 'ulid':
      return {type: 'string'};
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
): Record<string, object> {
  const properties: Record<string, object> = {};

  for (const [fName, f] of Object.entries(model.fields)) {
    Object.assign(properties, buildFilterQueryProperties(fName, f));
  }

  const sortableFields = Object.entries(model.fields)
    .filter(([, f]) => f.query?.includes('sort'))
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
): Record<string, object> {
  const ops = field.query || [];
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

/**
 * Build (or reuse) the JSON schema for a POST body based on the model.
 *
 * Rules for generated schema:
 * - Every field is included in `properties`.
 * - `required` includes fields that are NOT marked `nullable` and have NO `default`.
 * - If `model.validation` is provided, it is used verbatim.
 */
export function generateJSONValidationSchema(
  model: ModelConfig,
  options: {ignorePrimaryKey?: boolean; additionalProperties?: boolean} = {},
): Record<string, unknown> {
  if (model.validation) return normalizeSchemaForAjv(model.validation);

  const fields = options.ignorePrimaryKey
    ? Object.entries(model.fields).filter(
        ([, field]) => field.primaryKey !== true,
      )
    : Object.entries(model.fields);

  const bodyProperties: Record<string, object> = {};
  for (const [fieldName, field] of fields) {
    bodyProperties[fieldName] = {
      ...mapDataTypeToJsonSchema(field.type),
      ...(field.type === 'enum' && field.values ? {enum: field.values} : {}),
      description: `Value for ${fieldName}`,
    };
  }

  const required = fields
    .filter(
      ([, field]) => field.nullable !== true && field.default === undefined,
    )
    .map(([fieldName]) => fieldName);

  return {
    type: 'object',
    properties: bodyProperties,
    ...(required.length > 0 ? {required} : {}),
    ...(options.additionalProperties
      ? {additionalProperties: true}
      : {additionalProperties: false}),
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
    ? Object.entries(model.fields).filter(
        ([, field]) => field.primaryKey !== true,
      )
    : Object.entries(model.fields);

  const allowed = new Set(allowedFields.map(([name]) => name));
  const filtered: ModelBody = {};

  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

export function shouldApiBeEnabled(
  config: AppConfig,
  apiIdentifier: string,
  modelName: string,
): boolean {
  const authModel =
    config.authentication?.provider?.type === 'up-auth'
      ? (config.authentication.provider.config as UpAuthProviderConfig)
          .userModel.model
      : null;

  const apiEnabled = config.apis?.[apiIdentifier]?.enabled;

  if (apiEnabled === false) return false;

  if (modelName === authModel) return apiEnabled === true;

  return true;
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
 * Build the security array for the schema based on authentication config.
 */
export function buildSecurityArray(
  config: AppConfig,
  authorization: boolean,
): Array<{[key: string]: string[]}> {
  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  return security;
}

/**
 * Auth + SSP checks that can be performed in preValidation.
 */
export type PreValidationCheck = 'auth' | 'ssp';

/**
 * Build a preValidation handler that runs the specified checks.
 *
 *   - 'auth': authenticate the request if auth is enabled + authorization flag is set
 *   - 'ssp':  enforce single-session-policy
 */
export function buildPreValidation(
  app: FastifyInstance,
  config: AppConfig,
  authorization: boolean,
  checks: PreValidationCheck[] = ['auth', 'ssp'],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void | undefined> {
  return async (request, reply) => {
    if (
      checks.includes('auth') &&
      config.authentication?.enabled &&
      authorization
    ) {
      try {
        await request.authenticate();
      } catch {
        return reply
          .status(401)
          .send(
            app.buildResponse(
              401,
              'Invalid or expired authentication token',
              null,
            ),
          );
      }
    }
    if (checks.includes('ssp')) {
      app.enforceSSP(request);
    }
  };
}

/**
 * Try to parse a string as a number; return the original if it fails.
 */
function tryParseNumber(value: string): string | number {
  const trimmed = value.trim();
  if (trimmed === '') return value;
  const n = Number(trimmed);
  return Number.isNaN(n) ? value : n;
}

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
 * The query param suffixes use the OLD naming convention (_eq, _lt, _lte, _gt, _gte, _in).
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
    } else if (key.endsWith('_not_in')) {
      const notInValues = String(queryParams[key]).split(',');
      const notInParams = notInValues.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(
        `"${key.replace('_not_in', '')}" NOT IN (${notInParams})`,
      );
      values.push(...notInValues.map(tryParseNumber));
    } else if (key.endsWith('_in')) {
      const inValues = String(queryParams[key]).split(',');
      const inParams = inValues.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`"${key.replace('_in', '')}" IN (${inParams})`);
      values.push(...inValues.map(tryParseNumber));
    } else if (key.endsWith('_ne')) {
      whereClauses.push(`"${key.replace('_ne', '')}" != $${paramIndex++}`);
      values.push(queryParams[key]);
    }
  }

  return {whereClauses, values, nextParamIndex: paramIndex};
}
