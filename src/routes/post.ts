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
    // generating the JSON schema for the request body
    // we ignore the primary key since it's typically auto-generated (like serial or uuid)
    // and we set additionalProperties to false for strict validation
    const bodySchema = generateJSONValidationSchema(model, {
      ignorePrimaryKey: true,
      additionalProperties: false,
    });

    // defining the swagger schema for the POST API
    const schema: Record<string, unknown> = {
      summary: `Create a new ${capitalizeFirstLetter(model.name)} record`,
      description: `Create a new ${capitalizeFirstLetter(model.name)} record in the database`,
      tags: [capitalizeFirstLetter(model.name), 'Insert'],
      body: bodySchema,
      // the response structure for successful creation (201 Created)
      response: getResponseStructureSchema([201], bodySchema, bodySchema),
    };

    app.post(
      `/${model.name}/`,
      {
        schema,
      },
      async (
        request: FastifyRequest<{Body: ModelBody}>,
        reply: FastifyReply,
      ) => {
        const tableName = model.name;
        const incomingBody = request.body;

        // sanitizing the incoming body to make sure only the fields defined in the model are used
        // for example, if user passes "unknown_field", it will be stripped away
        const body = stripAdditionalPostFields(model, incomingBody, {
          ignorePrimaryKey: true,
        });
        const keys = Object.keys(body);
        const values = Object.values(body);

        // building the INSERT query dynamically based on the keys provided in the body
        // we wrap column names in double quotes to handle case sensitivity and special characters
        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = values
          .map((_, index) => `$${index + 1}`)
          .join(', ');
        const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;

        // executing the insert query
        const res = await app.db.query(query, values);

        // returning the standard response with 201 status code
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
