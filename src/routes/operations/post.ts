import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, ModelConfig} from '@/interfaces/config';

import {enforceSSP} from '@/utils/ssp';
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
  config: AppConfig,
): void {
  const {models} = config;

  for (const model of models) {
    // constructing the api identifier
    const apiIdentifier = `modelAPIs->${model.name}->all->insert`;

    // extracting the api configs based on the api identifier
    const sspConfig = config.apis?.[apiIdentifier]?.ssp ?? [];

    // calculating the authroization based on auth flag, it can be true
    // if the api level auth is enabled, or if the app level auth is enabled
    const authorization =
      config.apis?.[apiIdentifier]?.authorization ??
      config.auth?.enableAuth ??
      false;

    // generating the JSON schema for the request body
    // we ignore the primary key since it's typically auto-generated (like serial or uuid)
    // and we set additionalProperties to false for strict validation
    const schema: Record<string, unknown> = generateSchema(
      model,
      config,
      authorization,
    );

    app.post(
      `/${model.name}/`,
      {
        schema,
        config: {apiIdentifier},
        preValidation: async (request, reply) => {
          if (config.auth?.enableAuth && authorization) {
            try {
              await request.jwtVerify();
            } catch {
              return reply
                .status(401)
                .send(
                  app.buildResponse(
                    401,
                    'Invalid or expired authentication token',
                    null,
                  ),
                );
            }
          }
          enforceSSP(sspConfig, request);
        },
        preHandler: async request => {
          await app.callWebhook('request', request, null);
        },
        onSend: async (request, _, payload) => {
          await app.callWebhook('response', request, payload);
        },
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
function generateSchema(
  model: ModelConfig,
  config: AppConfig,
  authorization: boolean,
) {
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

  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
