import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { paginationQueryProperties, helloWorldResponseSchema } from './schema-helpers';

/**
 * Register SEARCH routes for searchable fields.
 *
 * For each model, for each field with 'searchable' in supportedOperations, creates:
 *   GET /{model}/search/{columnName}
 *
 * Query params:
 *   - {columnName}_search (required) — the search pattern
 *   - page, limit — pagination
 */
export function registerSearchRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const searchableFields = model.fields.filter((f) =>
      f.supportedOperations?.includes('searchable')
    );

    for (const field of searchableFields) {
      const queryProperties: Record<string, object> = {
        [`${field.name}_search`]: {
          type: 'string',
          description: `Search pattern to match against ${field.name}`,
        },
        ...paginationQueryProperties,
      };

      app.get(
        `/${model.name}/search/${field.name}`,
        {
          schema: {
            description: `Search ${model.name} by ${field.name}`,
            tags: [model.name],
            querystring: {
              type: 'object',
              properties: queryProperties,
              required: [`${field.name}_search`],
            },
            response: helloWorldResponseSchema,
          },
        },
        async () => ({ message: 'hello world' })
      );
    }
  }
}
