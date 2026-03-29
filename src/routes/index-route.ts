import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import {
  mapDataTypeToJsonSchema,
  buildFilterQueryProperties,
  paginationQueryProperties,
  helloWorldResponseSchema,
} from './schema-helpers';

/**
 * Register INDEX routes for primaryKey fields.
 *
 * For each model, for each field with primaryKey: true, creates:
 *   GET /{model}/{columnName}/:value
 *
 * Includes filter query params based on the field's supportedOperations.
 * Includes pagination if the field is not unique.
 */
export function registerIndexRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const pkFields = model.fields.filter((f) => f.primaryKey);

    for (const field of pkFields) {
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      // Build filter query params from the field's supported operations
      const filterProps = buildFilterQueryProperties(field);
      const queryProperties: Record<string, object> = {
        ...filterProps,
      };

      // Primary keys are always unique, so no pagination needed.
      // If we ever support non-PK indexable fields, add pagination for non-unique ones.
      if (!field.unique && !field.primaryKey) {
        Object.assign(queryProperties, paginationQueryProperties);
      }

      const schema: Record<string, unknown> = {
        description: `Get ${model.name} record(s) by ${field.name}`,
        tags: [model.name],
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
        response: helloWorldResponseSchema,
      };

      if (Object.keys(queryProperties).length > 0) {
        schema.querystring = {
          type: 'object',
          properties: queryProperties,
        };
      }

      app.get(`/${model.name}/${field.name}/:${field.name}`, { schema }, async () => ({
        message: 'hello world',
      }));
    }
  }
}
