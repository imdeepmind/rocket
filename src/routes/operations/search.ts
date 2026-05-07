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

import {enforceSSP} from '@/utils/ssp';
import {capitalizeFirstLetter} from '@/utils/string';
import {callWebhook} from '@/utils/webhook';

/**
 * Register SEARCH routes for searchable fields.
 *
 * For each model, for each field with 'searchable' in supportedOperations, creates:
 *   GET /{model}/search/{columnName}
 *
 * Query params:
 *   - {columnName}_search (required) — the search pattern
 *   - Other filter params based on the model's supportedOperations
 *   - orderBy, orderDir — sorting
 *   - page, limit — pagination
 */
export function registerSearchRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config;

  for (const model of models) {
    const searchableFields = model.fields.filter(f =>
      f.supportedOperations?.includes('searchable'),
    );

    // unique api identifier
    const apiIdentifier = `modelAPIs->search->${model.name}`;
    const webhookConfig = config.apis?.[apiIdentifier]?.webhooks ?? null;
    const sspConfig = config.apis?.[apiIdentifier]?.ssp ?? [];
    const authorization = config.apis?.[apiIdentifier]?.authorization ?? false;

    for (const field of searchableFields) {
      // defining the primary search query parameter
      // for example if the field is "name", this will create "name_search" query parameter
      const schema: Record<string, unknown> = generateSchema(
        field,
        model,
        config,
      );

      app.get(
        `/${model.name}/search/${field.name}`,
        {
          schema,
          preValidation: async request => enforceSSP(sspConfig, request),
          preHandler: async (request, reply) => {
            if (config.auth?.enableAuth && authorization) {
              try {
                await request.jwtVerify();
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
            await callWebhook('request', webhookConfig, request, null, app.log);
          },
          onSend: async (request, _, payload) => {
            await callWebhook(
              'response',
              webhookConfig,
              request,
              payload,
              app.log,
            );
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          const queryParams = request.query as Record<string, unknown>;
          const tableName = model.name;

          // base query to fetch records
          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          // building the search condition using LIKE for partial matching
          // we use LOWER() on both the field and the term for case-insensitive search
          const searchTerm = String(queryParams[`${field.name}_search`] || '');
          whereClauses.push(`LOWER("${field.name}") LIKE $${paramIndex++}`);
          values.push(`%${searchTerm.toLowerCase()}%`);

          // applying additional filters if any
          // we exclude the search parameter itself as it's already handled above
          const {
            whereClauses: filterClauses,
            values: filterValues,
            nextParamIndex,
          } = applyFilters(queryParams, paramIndex, [`${field.name}_search`]);

          whereClauses.push(...filterClauses);
          values.push(...filterValues);
          paramIndex = nextParamIndex;

          // join all where clauses into the query
          if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
          const countRes = await app.db.query<{total: number | string}>(
            countQuery,
            values,
          );
          const total = Number(countRes.rows[0]?.total || 0);

          // applying sorting
          if (queryParams.orderBy) {
            query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
          }

          // pagination logic
          const page = Math.max(Number(queryParams.page) || 1, 1);
          const limit = Math.min(
            Math.max(Number(queryParams.limit) || 20, 10),
            100,
          );
          const offset = (page - 1) * limit;

          // finalizing query with LIMIT and OFFSET
          query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
          values.push(limit, offset);

          // database execution
          const res = await app.db.query(query, values);

          // returning the standardized response using app.buildResponse
          return reply.status(200).send(
            app.buildResponse(
              200,
              `Successfully searched records from the ${tableName} table`,
              {
                data: res.rows || [], // returning the rows (or an empty array if none found)
                pagination: {page, limit, total}, // including the pagination metadata
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
  field: ModelFieldConfig,
  model: ModelConfig,
  config: AppConfig,
) {
  const queryProperties: Record<string, object> = {
    [`${field.name}_search`]: {
      type: 'string',
      description: `Search pattern to match against ${field.name}`,
    },
  };

  // alongside search, we also support general filtering on all fields
  for (const f of model.fields) {
    Object.assign(queryProperties, buildFilterQueryProperties(f));
  }

  // sorting support: "orderBy" and "orderDir"
  const sortableFields = model.fields
    .filter(f => f.supportedOperations?.includes('sortable'))
    .map(f => f.name);
  Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

  // pagination support: "page" and "limit"
  Object.assign(queryProperties, paginationQueryProperties);

  const schema: Record<string, unknown> = {
    summary: `Search ${capitalizeFirstLetter(model.name)} records by ${field.name}`,
    description: `Search ${model.name} records from the database using a LIKE pattern on ${field.name}`,
    tags: [capitalizeFirstLetter(model.name), 'Read'],
    // defining the schema for query parameters
    querystring: {
      type: 'object',
      properties: queryProperties,
      required: [`${field.name}_search`], // search term is required for this route
      additionalProperties: false,
    },
    // generating the response schema including data array and pagination info
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

  if (config.auth?.enableAuth && config.auth?.authEngine === 'up-auth') {
    security.push({bearerAuth: []});
  }

  if (config.auth?.enableAuth && config.auth?.authEngine === 'api-key') {
    security.push({apiKeyAuth: []});
  }

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
