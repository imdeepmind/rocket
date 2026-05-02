import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {AppConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';
import {callWebhook} from '@/utils/webhook';

/**
 * Register DELETE routes for deletable fields.
 *
 * For each model, for each field with 'deletable' in supportedOperations, creates:
 *   DELETE /{model}/{columnName}/:value
 *
 * Path params: the column value identifying the record to delete.
 */
export function registerDeleteRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  // We're iterating over all models provided in the configuration.
  // For each model, we'll check if there are any fields that support the 'deletable' operation.
  const {models} = config;

  for (const model of models) {
    // Identifying fields that are marked as deletable in the configuration.
    // If a field has 'deletable' in its supportedOperations array, it means
    // we want to allow users to delete records by providing a value for this specific field.
    const deletableFields = model.fields.filter(f =>
      f.supportedOperations?.includes('deletable'),
    );

    // Unique api identifier
    const apiIdentifier = `modelAPIs->delete->${model.name}`;
    const webhookConfig = config.apis?.[apiIdentifier]?.webhooks ?? null;

    // If we have deletable fields, we register a DELETE route for each.
    for (const field of deletableFields) {
      // we map the data type of the field to a JSON schema type for validation
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      // now we're configuring the swagger schema for the DELETE API
      // it uses the model details to generate the schema

      const schema: Record<string, unknown> = {
        summary: `Delete ${capitalizeFirstLetter(model.name)} records by ${field.name}`,
        description: `Delete records from ${capitalizeFirstLetter(model.name)} table where ${field.name} matches the provided value`,
        tags: [capitalizeFirstLetter(model.name), 'Delete'],
        params: {
          type: 'object',
          properties: {
            // this is the identifier field we're using to locate the record(s) to delete
            [field.name]: {
              ...paramSchema,
              description: `The ${field.name} value identifying the record to delete`,
            },
          },
          required: [field.name],
          // we set additionalProperties to false for strict validation of the path parameters
          additionalProperties: false,
        },
        // standard response structure for successful deletion (204 No Content)
        response: getResponseStructureSchema([204], {}),
      };

      const security: Array<{[key: string]: string[]}> = [];

      if (config.auth?.enableAuth && config.auth?.authEngine === 'up-auth') {
        security.push({bearerAuth: []});
      }

      if (config.auth?.enableAuth && config.auth?.authEngine === 'api-key') {
        security.push({apiKeyAuth: []});
      }

      if (security.length > 0) {
        schema.security = security;
      }

      app.delete(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema,
          preHandler: async (request, reply) => {
            if (config.auth?.enableAuth) {
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
            await callWebhook('request', webhookConfig, request, null, app.log);
          },
          onSend: async (request, _, payload) => {
            await callWebhook(
              'response',
              webhookConfig,
              request,
              payload,
              app.log,
            );
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          // extracting the parameter value from the request
          const {[field.name]: value} = request.params as Record<
            string,
            unknown
          >;

          // Before we execute the query, we identify the table and column names.
          // In this architecture, they come directly from the model configuration.
          const tableName = model.name;
          const columnName = field.name;

          // Building the DELETE query. We use double quotes for table and column names
          // to handle cases where they might be SQL reserved words or have special characters
          const query = `DELETE FROM "${tableName}" WHERE "${columnName}" = $1;`;

          // executing the deletion query in the database
          // the value is passed as a parameter to prevent SQL injection
          await app.db.query(query, [value]);

          // returning 204 No Content to indicate successful deletion
          return reply.status(204).send();
        },
      );
    }
  }
}
