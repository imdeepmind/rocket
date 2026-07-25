import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register GET_ALL routes for listing records (table-level).
 *
 * For each model that has fields, creates:
 *   GET /{model}/
 *
 * Query params:
 *   - Filter params for ALL fields based on their operations
 *   - orderBy / orderDir for sortable fields
 *   - page / limit for pagination
 */
export function registerGetAllRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const apiIdentifier = `modelAPIs.${modelName}.all.getAll`;

    if (config.apis?.[apiIdentifier]?.enabled === false) continue;

    const authorization =
      config.apis?.[apiIdentifier]?.authorization ??
      config.authentication?.enabled ??
      false;

    const schema: Record<string, unknown> = generateSchema(
      model,
      modelName,
      config,
      authorization,
    );

    app.get(
      `/${modelName}/`,
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
        console.log(request.user);
        const queryParams = request.query as Record<string, unknown>;
        const tableName = modelName;

        let query = `SELECT * FROM "${tableName}"`;
        const values: unknown[] = [];
        let paramIndex = 1;

        const whereClauses: string[] = [];

        const {
          whereClauses: filterClauses,
          values: filterValues,
          nextParamIndex,
        } = applyFilters(queryParams, paramIndex);

        whereClauses.push(...filterClauses);
        values.push(...filterValues);
        paramIndex = nextParamIndex;

        if (whereClauses.length > 0) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
        const countRes = await app.db.query<{total: number | string}>(
          countQuery,
          filterValues,
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
            `Successfully retrieved records from the ${tableName} table`,
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
function generateSchema(
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const queryProperties: Record<string, object> = {};

  for (const [fName, f] of Object.entries(model.fields)) {
    Object.assign(queryProperties, buildFilterQueryProperties(fName, f));
  }

  const sortableFields = Object.entries(model.fields)
    .filter(([, f]) => f.operations?.includes('sort'))
    .map(([fName]) => fName);
  Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

  Object.assign(queryProperties, paginationQueryProperties);

  const schema: Record<string, unknown> = {
    summary: `Get all ${capitalizeFirstLetter(modelName)} records`,
    description: `Get all ${modelName} records from the database`,
    tags: [capitalizeFirstLetter(modelName), 'Read'],
    querystring: {
      type: 'object',
      properties: queryProperties,
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
