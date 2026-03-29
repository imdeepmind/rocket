import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import {
  buildFilterQueryProperties,
  buildSortQueryProperties,
  paginationQueryProperties,
  helloWorldResponseSchema,
} from './schema-helpers';

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
    if (model.fields.length === 0) continue;

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
          description: `Get all ${model.name} records`,
          tags: [model.name],
          querystring: {
            type: 'object',
            properties: queryProperties,
          },
          response: helloWorldResponseSchema,
        },
      },
      async () => ({ message: 'hello world' })
    );
  }
}
