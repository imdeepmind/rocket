import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, ModelConfig} from '@/interfaces/config';

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
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const apiIdentifier = `modelAPIs.${modelName}.all.insert`;

    if (config.apis?.[apiIdentifier]?.enabled === false) continue;

    const authorization =
      config.apis?.[apiIdentifier]?.authorization ??
      config.authentication?.enabled ??
      false;

    const schema: Record<string, unknown> = generateSchema(
      model,
      modelName,
      config,
      authorization,
    );

    app.post(
      `/${modelName}/`,
      {
        schema,
        config: {apiIdentifier},
        preValidation: async (request, reply) => {
          if (config.authentication?.enabled && authorization) {
            try {
              await request.authenticate();
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
          app.enforceSSP(request);
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
        const tableName = modelName;
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
function generateSchema(
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const bodySchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
  });

  const schema: Record<string, unknown> = {
    summary: `Create a new ${capitalizeFirstLetter(modelName)} record`,
    description: `Create a new ${capitalizeFirstLetter(modelName)} record in the database`,
    tags: [capitalizeFirstLetter(modelName), 'Insert'],
    body: bodySchema,
    response: getResponseStructureSchema([201], bodySchema, bodySchema),
  };

  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
