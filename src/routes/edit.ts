import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { mapDataTypeToJsonSchema, helloWorldResponseSchema } from './schema-helpers';

/**
 * Register EDIT routes for editable fields.
 *
 * For each model, for each field with 'editable' in supportedOperations, creates:
 *   PUT /{model}/{columnName}/:value
 *
 * Path params: the column value identifying the record to edit.
 * Body: all other fields as optional properties for updating.
 */
export function registerEditRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const editableFields = model.fields.filter((f) => f.supportedOperations?.includes('editable'));

    for (const field of editableFields) {
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      // Body contains all other fields as optional update targets
      const bodyProperties: Record<string, object> = {};
      for (const otherField of model.fields) {
        if (otherField.name === field.name) continue;
        bodyProperties[otherField.name] = {
          ...mapDataTypeToJsonSchema(otherField.type),
          description: `Updated value for ${otherField.name}`,
        };
      }

      app.put(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema: {
            description: `Edit ${model.name} record by ${field.name}`,
            tags: [model.name],
            params: {
              type: 'object',
              properties: {
                [field.name]: {
                  ...paramSchema,
                  description: `The ${field.name} value identifying the record to edit`,
                },
              },
              required: [field.name],
            },
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
}
