import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {ModelBody, ModelConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register POST routes for creating records (table-level).
 *
 * For each model that has fields, creates:
 *   POST /{model}/
 *
 * Body: all fields as optional properties for creating a new record.
 */
export function registerPostRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
): void {
  for (const model of models) {
    const bodySchema = generateJSONValidationSchema(model, {
      ignorePrimaryKey: true,
    });

    app.post(
      `/${model.name}/`,
      {
        schema: {
          summary: `Create a new ${capitalizeFirstLetter(model.name)} record`,
          description: `Create a new ${capitalizeFirstLetter(model.name)} record in the database`,
          tags: [capitalizeFirstLetter(model.name), 'Insert'],
          body: bodySchema,
          response: getResponseStructureSchema([201], bodySchema, bodySchema),
        },
      },
      async (
        request: FastifyRequest<{Body: ModelBody}>,
        reply: FastifyReply,
      ) => {
        const tableName = model.name;
        const incomingBody = request.body;
        const body = stripAdditionalPostFields(model, incomingBody, {
          ignorePrimaryKey: true,
        });
        const keys = Object.keys(body);
        const values = Object.values(body);

        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = values
          .map((_, index) => `$${index + 1}`)
          .join(', ');
        const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;

        const res = await app.db.query(query, values);

        return reply
          .status(201)
          .send(
            app.buildResponse(
              201,
              `Successfully added the new entry to the ${tableName} table`,
              body,
              res,
            ),
          );
      },
    );
  }
}
