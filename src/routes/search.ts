import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {ModelConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

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
  models: ModelConfig[],
): void {
  for (const model of models) {
    const searchableFields = model.fields.filter(f =>
      f.supportedOperations?.includes('searchable'),
    );

    for (const field of searchableFields) {
      const queryProperties: Record<string, object> = {
        [`${field.name}_search`]: {
          type: 'string',
          description: `Search pattern to match against ${field.name}`,
        },
      };

      // Add filter params for each field based on its supportedOperations
      for (const f of model.fields) {
        Object.assign(queryProperties, buildFilterQueryProperties(f));
      }

      // Add sort params for sortable fields
      const sortableFields = model.fields
        .filter(f => f.supportedOperations?.includes('sortable'))
        .map(f => f.name);
      Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

      // Add pagination
      Object.assign(queryProperties, paginationQueryProperties);

      const schema: Record<string, unknown> = {
        summary: `Search ${capitalizeFirstLetter(model.name)} records by ${field.name}`,
        description: `Search ${model.name} records from the database using a LIKE pattern on ${field.name}`,
        tags: [capitalizeFirstLetter(model.name), 'Read'],
        querystring: {
          type: 'object',
          properties: queryProperties,
          required: [`${field.name}_search`],
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
                },
              },
            },
          },
          generateJSONValidationSchema(model),
        ),
      };

      app.get(
        `/${model.name}/search/${field.name}`,
        {schema},
        async (request: FastifyRequest, reply: FastifyReply) => {
          const queryParams = request.query as Record<string, unknown>;
          const tableName = model.name;

          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          // The primary search condition (case-insensitive)
          const searchTerm = String(queryParams[`${field.name}_search`] || '');
          whereClauses.push(`LOWER("${field.name}") LIKE $${paramIndex++}`);
          values.push(`%${searchTerm.toLowerCase()}%`);

          // Filters
          const {
            whereClauses: filterClauses,
            values: filterValues,
            nextParamIndex,
          } = applyFilters(queryParams, paramIndex, [`${field.name}_search`]);

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
              `Successfully searched records from the ${tableName} table`,
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
}
