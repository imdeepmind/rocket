import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildPostBodyValidationSchema,
  buildSortQueryProperties,
  getResponseStructureSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {ModelConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register GET_ALL routes for listing records (table-level).
 *
 * For each model that has fields, creates:
 *   GET /{model}/
 *
 * Query params:
 *   - Filter params for ALL fields based on their supportedOperations
 *   - orderBy / orderDir for sortable fields
 *   - page / limit for pagination
 */
export function registerGetAllRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
): void {
  for (const model of models) {
    const queryProperties: Record<string, object> = {};

    // Add filter params for each field based on its supportedOperations
    for (const field of model.fields) {
      Object.assign(queryProperties, buildFilterQueryProperties(field));
    }

    // Add sort params for sortable fields
    const sortableFields = model.fields
      .filter(f => f.supportedOperations?.includes('sortable'))
      .map(f => f.name);
    Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

    // Add pagination
    Object.assign(queryProperties, paginationQueryProperties);

    app.get(
      `/${model.name}/`,
      {
        schema: {
          summary: `Get all ${capitalizeFirstLetter(model.name)} records`,
          description: `Get all ${model.name} records`,
          tags: [capitalizeFirstLetter(model.name), 'Read'],
          querystring: {
            type: 'object',
            properties: queryProperties,
          },
          response: getResponseStructureSchema(
            [200],
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: buildPostBodyValidationSchema(model),
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: {type: 'integer'},
                    limit: {type: 'integer'},
                  },
                },
              },
            },
            buildPostBodyValidationSchema(model),
          ),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const queryParams = request.query as Record<string, unknown>;
        const tableName = model.name;

        let query = `SELECT * FROM "${tableName}"`;
        const values: unknown[] = [];
        let paramIndex = 1;

        const whereClauses: string[] = [];

        // Filters
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

        // Order By
        if (queryParams.orderBy) {
          query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
        }

        // Pagination
        const page = Math.max(Number(queryParams.page) || 1, 1);
        const limit = Math.max(Number(queryParams.limit) || 20, 1);
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
              pagination: {page, limit},
            },
            res,
          ),
        );
      },
    );
  }
}
