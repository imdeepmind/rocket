import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register SEARCH routes for searchable fields.
 *
 * For each model, for each field with 'search' in operations, creates:
 *   GET /{model}/search/{columnName}
 *
 * Query params:
 *   - {columnName}_search (required) — the search pattern
 *   - Other filter params based on the model's operations
 *   - orderBy, orderDir — sorting
 *   - page, limit — pagination
 */
export function registerSearchRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const searchableFields = Object.entries(model.fields).filter(([, f]) =>
      f.operations?.includes('search'),
    );

    for (const [fieldName, field] of searchableFields) {
      const apiIdentifier = `modelAPIs.${modelName}.${fieldName}.search`;

      if (config.apis?.[apiIdentifier]?.enabled === false) continue;

      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;

      const schema: Record<string, unknown> = generateSchema(
        fieldName,
        field,
        model,
        modelName,
        config,
        authorization,
      );

      app.get(
        `/${modelName}/search/${fieldName}`,
        {
          schema,
          config: {apiIdentifier},
          preValidation: async (request, reply) => {
            if (config.authentication?.enabled && authorization) {
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
            app.enforceSSP(request);
          },
          preHandler: async request => {
            await app.callWebhook('request', request, null);
          },
          onSend: async (request, _, payload) => {
            await app.callWebhook('response', request, payload);
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          const queryParams = request.query as Record<string, unknown>;
          const tableName = modelName;

          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          const searchTerm = String(queryParams[`${fieldName}_search`] || '');
          whereClauses.push(`LOWER("${fieldName}") LIKE $${paramIndex++}`);
          values.push(`%${searchTerm.toLowerCase()}%`);

          const {
            whereClauses: filterClauses,
            values: filterValues,
            nextParamIndex,
          } = applyFilters(queryParams, paramIndex, [`${fieldName}_search`]);

          whereClauses.push(...filterClauses);
          values.push(...filterValues);
          paramIndex = nextParamIndex;

          if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
          const countRes = await app.db.query<{total: number | string}>(
            countQuery,
            values,
          );
          const total = Number(countRes.rows[0]?.total || 0);

          if (queryParams.orderBy) {
            query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
          }

          const page = Math.max(Number(queryParams.page) || 1, 1);
          const limit = Math.min(
            Math.max(Number(queryParams.limit) || 20, 10),
            100,
          );
          const offset = (page - 1) * limit;

          query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
          values.push(limit, offset);

          const res = await app.db.query(query, values);

          return reply.status(200).send(
            app.buildResponse(
              200,
              `Successfully searched records from the ${tableName} table`,
              {
                data: res.rows || [],
                pagination: {page, limit, total},
              },
              res,
            ),
          );
        },
      );
    }
  }
}

function generateSchema(
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const queryProperties: Record<string, object> = {
    [`${fieldName}_search`]: {
      type: 'string',
      description: `Search pattern to match against ${fieldName}`,
    },
  };

  for (const [fName, f] of Object.entries(model.fields)) {
    Object.assign(queryProperties, buildFilterQueryProperties(fName, f));
  }

  const sortableFields = Object.entries(model.fields)
    .filter(([, f]) => f.operations?.includes('sort'))
    .map(([fName]) => fName);
  Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

  Object.assign(queryProperties, paginationQueryProperties);

  const schema: Record<string, unknown> = {
    summary: `Search ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
    description: `Search ${modelName} records from the database using a LIKE pattern on ${fieldName}`,
    tags: [capitalizeFirstLetter(modelName), 'Read'],
    querystring: {
      type: 'object',
      properties: queryProperties,
      required: [`${fieldName}_search`],
      additionalProperties: false,
    },
    response: getResponseStructureSchema(
      [200],
      {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: generateJSONValidationSchema(model),
          },
          pagination: {
            type: 'object',
            properties: {
              page: {type: 'integer'},
              limit: {type: 'integer'},
              total: {type: 'integer'},
            },
          },
        },
      },
      generateJSONValidationSchema(model),
    ),
  };

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

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
