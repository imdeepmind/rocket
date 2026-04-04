import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { ModelConfig } from '../schema/config';
import {
  buildFilterQueryProperties,
  buildSortQueryProperties,
  paginationQueryProperties,
  getResponseStructureSchema,
} from './schema-helpers';
import { capitalizeFirstLetter } from '../utils/string';

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
export function registerGetAllRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const queryProperties: Record<string, object> = {};

    // Add filter params for each field based on its supportedOperations
    for (const field of model.fields) {
      Object.assign(queryProperties, buildFilterQueryProperties(field));
    }

    // Add sort params for sortable fields
    const sortableFields = model.fields
      .filter((f) => f.supportedOperations?.includes('sortable'))
      .map((f) => f.name);
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
          response: getResponseStructureSchema([200], {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                },
              },
            },
          }),
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
        for (const key of Object.keys(queryParams)) {
          if (['page', 'limit', 'orderBy', 'orderDir'].includes(key)) continue;

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
              pagination: { page, limit },
            },
            res
          )
        );
      }
    );
  }
}
