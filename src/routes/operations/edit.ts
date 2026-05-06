import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody} from '@/interfaces/config';

import {enforceSSP} from '@/utils/ssp';
import {capitalizeFirstLetter} from '@/utils/string';
import {callWebhook} from '@/utils/webhook';

/**
 * Register EDIT routes for editable fields.
 *
 * For each model, for each field with 'editable' in supportedOperations, creates:
 *   PATCH /{model}/{columnName}/:value (partial update)
 *   PUT /{model}/{columnName}/:value (complete update)
 *
 * Path params: the column value identifying the record to edit.
 * Body: all other fields as properties for updating.
 * Filters: if the field is not unique, filter params are available.
 */
export function registerEditRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  // We're iterating over all models provided in the configuration.
  // For each model, we'll check if there are any fields that support the 'editable' operation.
  const {models} = config;

  for (const model of models) {
    // identifying fields that are marked as editable in the configuration
    const editableFields = model.fields.filter(f =>
      f.supportedOperations?.includes('editable'),
    );

    // unique api identifier
    const apiIdentifier = `modelAPIs->edit->${model.name}`;
    const webhookConfig = config.apis?.[apiIdentifier]?.webhooks ?? null;
    const sspConfig = config.apis?.[apiIdentifier]?.ssp ?? [];
    const authorization = config.apis?.[apiIdentifier]?.authorization ?? false;

    for (const field of editableFields) {
      const isUnique = field.primaryKey || field.unique;
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      // if the field is not unique, we can apply filters to target specific records
      // for example, if we edit by "status", we might want to only update records where "age > 18"
      const queryProperties: Record<string, object> = {};
      if (!isUnique) {
        for (const f of model.fields) {
          Object.assign(queryProperties, buildFilterQueryProperties(f));
        }
      }

      // the body will contain all other fields that can be updated
      // we exclude the current field we are using to identify the records
      const bodyProperties: Record<string, object> = {};
      const allBodyFieldNames: string[] = [];

      for (const otherField of model.fields) {
        if (otherField.name === field.name) continue;
        bodyProperties[otherField.name] = {
          ...mapDataTypeToJsonSchema(otherField.type),
          description: `Updated value for ${otherField.name}`,
        };
        allBodyFieldNames.push(otherField.name);
      }

      // building the schema for both PATCH (partial) and PUT (complete) updates
      const buildRouteSchema = (method: 'PATCH' | 'PUT') => {
        let finalBodySchema: Record<string, unknown>;

        // if a custom validation schema is provided in the model, we use it
        if (model.validation) {
          finalBodySchema = {...model.validation};
          if (method === 'PATCH') {
            // for PATCH requests, we remove 'required' to allow partial updates
            delete finalBodySchema.required;
          }
        } else {
          // otherwise, we generate a default object schema
          finalBodySchema = {
            type: 'object',
            properties: bodyProperties,
            // for PUT, all fields are required; for PATCH, they are optional
            required: method === 'PUT' ? allBodyFieldNames : [],
            additionalProperties: false,
          };
        }

        const responseDataSchema = {...finalBodySchema} as Record<
          string,
          unknown
        >;
        if (method === 'PATCH' && responseDataSchema.required) {
          delete responseDataSchema.required;
        }

        const schema: Record<string, unknown> = {
          summary: `${method === 'PATCH' ? 'Partial' : 'Complete'} edit of ${capitalizeFirstLetter(model.name)} record(s) by ${field.name}`,
          description: `${method} update on records from the database by ${field.name}`,
          tags: [capitalizeFirstLetter(model.name), 'Update'],
          params: {
            type: 'object',
            properties: {
              [field.name]: {
                ...paramSchema,
                description: `The ${field.name} value identifying the record to edit`,
              },
            },
            required: [field.name],
            additionalProperties: false,
          },
          body: finalBodySchema,
          response: getResponseStructureSchema([200], responseDataSchema),
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

        if (Object.keys(queryProperties).length > 0) {
          schema.querystring = {
            type: 'object',
            properties: queryProperties,
            additionalProperties: false,
          };
        }

        return schema;
      };

      const handleEditRequest = async (
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const queryParams = request.query as Record<string, unknown>;
        const params = request.params as Record<string, unknown>;
        const tableName = model.name;
        const body = request.body as ModelBody;

        // Remove the identifying field from the body if it was mistakenly provided
        delete body[field.name];

        const keys = Object.keys(body);
        if (keys.length === 0) {
          return reply
            .status(400)
            .send({error: 'No fields provided for update'});
        }

        const values: unknown[] = [];
        let paramIndex = 1;

        // building the SET clause of the UPDATE query
        const setClauses: string[] = [];
        for (const key of keys) {
          setClauses.push(`"${key}" = $${paramIndex++}`);
          values.push(body[key]);
        }

        const whereClauses: string[] = [];
        // primary condition: match the record by the identifying field from the URL path
        whereClauses.push(`"${field.name}" = $${paramIndex++}`);
        values.push(params[field.name]);

        // if the field is not unique, we apply additional filters from the query string
        if (!isUnique) {
          const {
            whereClauses: filterClauses,
            values: filterValues,
            nextParamIndex,
          } = applyFilters(queryParams, paramIndex, [field.name]);

          whereClauses.push(...filterClauses);
          values.push(...filterValues);
          paramIndex = nextParamIndex;
        }

        // join all parts to form the final UPDATE query
        const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

        // executing the update in the database
        const res = await app.db.query(query, values);

        return reply
          .status(200)
          .send(
            app.buildResponse(
              200,
              `Successfully updated records in the ${tableName} table`,
              body,
              res,
            ),
          );
      };

      app.patch(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema: buildRouteSchema('PATCH'),
          preValidation: async request => enforceSSP(sspConfig, request),
          preHandler: async (request, reply) => {
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
        handleEditRequest,
      );

      app.put(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema: buildRouteSchema('PUT'),
          preValidation: async request => enforceSSP(sspConfig, request),
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
        handleEditRequest,
      );
    }
  }
}
