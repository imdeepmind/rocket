import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { mapDataTypeToJsonSchema, helloWorldResponseSchema } from './schema-helpers';

/**
 * Register POST routes for creating records (table-level).
 *
 * For each model that has fields, creates:
 *   POST /{model}/
 *
 * Body: all fields as optional properties for creating a new record.
 */
export function registerPostRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    if (model.fields.length === 0) continue;

    const bodyProperties: Record<string, object> = {};
    for (const field of model.fields) {
      bodyProperties[field.name] = {
        ...mapDataTypeToJsonSchema(field.type),
        description: `Value for ${field.name}`,
      };
    }

    app.post(
      `/${model.name}/`,
      {
        schema: {
          description: `Create a new ${model.name} record`,
          tags: [model.name],
          body: {
            type: 'object',
            properties: bodyProperties,
          },
          response: helloWorldResponseSchema,
        },
      },
      async () => ({ message: 'hello world' })
    );
  }
}
