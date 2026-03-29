import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { mapDataTypeToJsonSchema, helloWorldResponseSchema } from './schema-helpers';

/**
 * Register DELETE routes for deletable fields.
 *
 * For each model, for each field with 'deletable' in supportedOperations, creates:
 *   DELETE /{model}/{columnName}/:value
 *
 * Path params: the column value identifying the record to delete.
 */
export function registerDeleteRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const deletableFields = model.fields.filter((f) =>
      f.supportedOperations?.includes('deletable')
    );

    for (const field of deletableFields) {
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      app.delete(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema: {
            description: `Delete ${model.name} record by ${field.name}`,
            tags: [model.name],
            params: {
              type: 'object',
              properties: {
                [field.name]: {
                  ...paramSchema,
                  description: `The ${field.name} value identifying the record to delete`,
                },
              },
              required: [field.name],
            },
            response: helloWorldResponseSchema,
          },
        },
        async () => ({ message: 'hello world' })
      );
    }
  }
}
