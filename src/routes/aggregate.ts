import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { helloWorldResponseSchema } from './schema-helpers';

/**
 * Register AGGREGATE routes for fields with supportedAggregation.
 *
 * For each model, for each field with non-empty supportedAggregation, creates:
 *   GET /{model}/aggregation/{columnName}
 *
 * Query params:
 *   - operations (string) — comma-separated list of aggregation operations to perform
 */
export function registerAggregateRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const aggregatableFields = model.fields.filter(
      (f) => f.supportedAggregation && f.supportedAggregation.length > 0
    );

    for (const field of aggregatableFields) {
      const operations = field.supportedAggregation!;

      app.get(
        `/${model.name}/aggregation/${field.name}`,
        {
          schema: {
            description: `Get aggregation data for ${field.name} in ${model.name}`,
            tags: [model.name],
            querystring: {
              type: 'object',
              properties: {
                operations: {
                  type: 'string',
                  description: `Comma-separated list of operations to perform: ${operations.join(', ')}`,
                },
              },
            },
            response: helloWorldResponseSchema,
          },
        },
        async () => ({ message: 'hello world' })
      );
    }
  }
}
