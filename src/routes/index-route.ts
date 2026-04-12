import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {ModelConfig} from '@/schema/config';
import {
  mapDataTypeToJsonSchema,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  paginationQueryProperties,
  getResponseStructureSchema,
  buildPostBodyValidationSchema,
} from '@/routes/schema-helpers';
import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register INDEX routes for indexed fields.
 *
 * For each model, for each field with primaryKey, unique, or in an index, creates:
 *   GET /{model}/{columnName}/:value
 *
 * Includes filter query params based on the model's supportedOperations,
 * as well as sorting and pagination, ONLY if the field is not unique.
 */
export function registerIndexRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
): void {
  for (const model of models) {
    // Determine which fields need an index route
    const indexFields = model.fields.filter(f => {
      return (
        f.primaryKey || f.unique || f.supportedOperations?.includes('indexable')
      );
    });

    for (const field of indexFields) {
      const isUnique = field.primaryKey || field.unique;
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      const queryProperties: Record<string, object> = {};

      if (!isUnique) {
        // Add filter params for each field based on its supportedOperations
        for (const f of model.fields) {
          Object.assign(queryProperties, buildFilterQueryProperties(f));
        }

        // Add sort params for sortable fields
        const sortableFields = model.fields
          .filter(f => f.supportedOperations?.includes('sortable'))
          .map(f => f.name);
        Object.assign(
          queryProperties,
          buildSortQueryProperties(sortableFields),
        );

        // Add pagination
        Object.assign(queryProperties, paginationQueryProperties);
      }

      const responseSchemaProperties: Record<string, object> = {
        data: isUnique
          ? {...buildPostBodyValidationSchema(model), nullable: true}
          : {type: 'array', items: buildPostBodyValidationSchema(model)},
      };

      if (!isUnique) {
        responseSchemaProperties.pagination = {
          type: 'object',
          properties: {
            page: {type: 'integer'},
            limit: {type: 'integer'},
          },
        };
      }

      const schema: Record<string, unknown> = {
        summary: `Get ${capitalizeFirstLetter(model.name)} record(s) by ${field.name}`,
        description: `Get ${model.name} record(s) from the database by ${field.name}`,
        tags: [capitalizeFirstLetter(model.name), 'Read'],
        params: {
          type: 'object',
          properties: {
            [field.name]: {
              ...paramSchema,
              description: `The ${field.name} value to look up`,
            },
          },
          required: [field.name],
        },
        response: getResponseStructureSchema(
          [200],
          {
            type: 'object',
            properties: responseSchemaProperties,
          },
          buildPostBodyValidationSchema(model),
        ),
      };

      if (Object.keys(queryProperties).length > 0) {
        schema.querystring = {
          type: 'object',
          properties: queryProperties,
        };
      }

      app.get(
        `/${model.name}/${field.name}/:${field.name}`,
        {schema},
        async (request: FastifyRequest, reply: FastifyReply) => {
          const queryParams = request.query as Record<string, unknown>;
          const params = request.params as Record<string, unknown>;
          const tableName = model.name;

          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          // The base path param condition:
          whereClauses.push(`"${field.name}" = $${paramIndex++}`);
          values.push(params[field.name]);

          if (!isUnique) {
            // Filters
            for (const key of Object.keys(queryParams)) {
              if (['page', 'limit', 'orderBy', 'orderDir'].includes(key))
                continue;

              if (key.endsWith('_eq')) {
                whereClauses.push(
                  `"${key.replace('_eq', '')}" = $${paramIndex++}`,
                );
                values.push(queryParams[key]);
              } else if (key.endsWith('_lt')) {
                whereClauses.push(
                  `"${key.replace('_lt', '')}" < $${paramIndex++}`,
                );
                values.push(queryParams[key]);
              } else if (key.endsWith('_lte')) {
                whereClauses.push(
                  `"${key.replace('_lte', '')}" <= $${paramIndex++}`,
                );
                values.push(queryParams[key]);
              } else if (key.endsWith('_gt')) {
                whereClauses.push(
                  `"${key.replace('_gt', '')}" > $${paramIndex++}`,
                );
                values.push(queryParams[key]);
              } else if (key.endsWith('_gte')) {
                whereClauses.push(
                  `"${key.replace('_gte', '')}" >= $${paramIndex++}`,
                );
                values.push(queryParams[key]);
              } else if (key.endsWith('_in')) {
                const inValues = String(queryParams[key]).split(',');
                const inParams = inValues
                  .map(() => `$${paramIndex++}`)
                  .join(', ');
                whereClauses.push(
                  `"${key.replace('_in', '')}" IN (${inParams})`,
                );
                values.push(...inValues);
              }
            }
          }

          if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          let page = 1;
          let limit = 20;

          if (!isUnique) {
            // Order By
            if (queryParams.orderBy) {
              query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
            }

            // Pagination
            page = Math.max(Number(queryParams.page) || 1, 1);
            limit = Math.max(Number(queryParams.limit) || 20, 1);
            const offset = (page - 1) * limit;

            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
            values.push(limit, offset);
          } else {
            query += ` LIMIT $${paramIndex++};`;
            values.push(1);
          }

          const res = await app.db.query(query, values);

          const responsePayload: Record<string, unknown> = {
            data: isUnique ? res.rows[0] || null : res.rows || [],
          };

          if (!isUnique) {
            responsePayload.pagination = {page, limit};
          }

          return reply
            .status(200)
            .send(
              app.buildResponse(
                200,
                `Successfully retrieved records from the ${tableName} table`,
                responsePayload,
                res,
              ),
            );
        },
      );
    }
  }
}
