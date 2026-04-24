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
      // we are building the query parameter names based on the supported operations
      // for example if there is a field called "status" with supported operations includes equal
      // then in the query string, user can pass "status=active" to filter the data
      Object.assign(queryProperties, buildFilterQueryProperties(field));
    }

    // if "sortable" is included in the supportedOperations, then we add sort parameters
    // two query parameters are added: "orderBy" (field name) and "orderDir" ("asc" or "desc")
    const sortableFields = model.fields
      .filter(f => f.supportedOperations?.includes('sortable'))
      .map(f => f.name);
    Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

    // finally adding pagination parameters: "page" and "limit"
    // defaults are page 1 and limit 20
    Object.assign(queryProperties, paginationQueryProperties);

    const schema: Record<string, unknown> = {
      summary: `Get all ${capitalizeFirstLetter(model.name)} records`,
      description: `Get all ${model.name} records from the database`,
      tags: [capitalizeFirstLetter(model.name), 'Read'],
      // defining the schema for query parameters we built above
      querystring: {
        type: 'object',
        properties: queryProperties,
        additionalProperties: false,
      },
      // generating the JSON schema for the response
      // it includes the record data array and pagination metadata
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
      `/${model.name}/`,
      {
        schema,
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const queryParams = request.query as Record<string, unknown>;
        const tableName = model.name;

        // building the base SELECT query to fetch all columns
        let query = `SELECT * FROM "${tableName}"`;
        const values: unknown[] = [];
        let paramIndex = 1;

        const whereClauses: string[] = [];

        // building the WHERE clause based on the filters passed in the query string
        const {
          whereClauses: filterClauses,
          values: filterValues,
          nextParamIndex,
        } = applyFilters(queryParams, paramIndex);

        whereClauses.push(...filterClauses);
        values.push(...filterValues);
        paramIndex = nextParamIndex;

        // if any filters are present, append them to the query
        if (whereClauses.length > 0) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // if orderBy is provided, append the ORDER BY clause
        if (queryParams.orderBy) {
          query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
        }

        // calculating page, limit and offset for pagination
        const page = Math.max(Number(queryParams.page) || 1, 1);
        const limit = Math.max(Number(queryParams.limit) || 20, 1);
        const offset = (page - 1) * limit;

        // appending LIMIT and OFFSET to the query using parameterized values for security
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(limit, offset);

        // executing the final query on the database
        const res = await app.db.query(query, values);

        // returning the standardized response using app.buildResponse
        return reply.status(200).send(
          app.buildResponse(
            200,
            `Successfully retrieved records from the ${tableName} table`,
            {
              data: res.rows || [], // returning the rows (or an empty array if none found)
              pagination: {page, limit}, // including the pagination metadata
            },
            res,
          ),
        );
      },
    );
  }
}
