import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { ModelBody, ModelConfig } from '../schema/config';
import { mapDataTypeToJsonSchema, helloWorldResponseSchema } from './schema-helpers';
import SQL from 'sql-template-strings';

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
          body: model.validation || {
            type: 'object',
            properties: bodyProperties,
          },
          response: helloWorldResponseSchema,
        },
      },
      async (request: FastifyRequest<{ Body: ModelBody }>, reply: FastifyReply) => {
        const tableName = request.url.split('/')[1];
        const body = request.body;

        const keys = Object.keys(body);
        const values = Object.values(body);

        if (keys.length === 0) {
          return reply.status(400).send({ error: 'Body cannot be empty' });
        }

        // Identifiers (table/column names) cannot be parameterized.
        const columns = keys.map((key) => `"${key}"`).join(', ');
        const query = SQL`INSERT INTO `.append(`"${tableName}"`).append(` (${columns}) VALUES (`);

        // Values are appended as parameters
        values.forEach((value, index) => {
          query.append(SQL`${value}`);
          if (index < values.length - 1) {
            query.append(', ');
          }
        });

        query.append(');');

        console.log(query.sql, query.values);
        const res = await app.db.query(query);

        console.log({ res });
        return { message: 'hello world' };
      }
    );
  }
}
