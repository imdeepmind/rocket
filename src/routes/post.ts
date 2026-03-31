import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { ModelBody, ModelConfig } from '../schema/config';
import { mapDataTypeToJsonSchema, getResponseStructureSchema } from './schema-helpers';

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

    const bodySchema = model.validation || {
      type: 'object',
      properties: bodyProperties,
    };

    app.post(
      `/${model.name}/`,
      {
        schema: {
          description: `Create a new ${model.name} record`,
          tags: [model.name],
          body: bodySchema,
          response: getResponseStructureSchema([201], bodySchema),
        },
      },
      async (request: FastifyRequest<{ Body: ModelBody }>, reply: FastifyReply) => {
        const tableName = request.url.split('/')[1];
        const body = request.body;

        const keys = Object.keys(body);
        const values = Object.values(body);

        const columns = keys.map((key) => `"${key}"`).join(', ');
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;

        const res = await app.db.query(query, values);

        return reply
          .status(201)
          .send(
            app.buildResponse(
              201,
              `Successfully added the new entry to the ${tableName} table`,
              body,
              res
            )
          );
      }
    );
  }
}
