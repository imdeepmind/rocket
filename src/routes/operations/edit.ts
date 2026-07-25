import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register EDIT routes for editable fields.
 *
 * For each model, for each field with 'edit' in operations, creates:
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
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const editableFields = Object.entries(model.fields).filter(([, f]) =>
      f.operations?.includes('edit'),
    );

    for (const [fieldName, field] of editableFields) {
      const apiIdentifier = `modelAPIs.${modelName}.${fieldName}.edit`;

      if (config.apis?.[apiIdentifier]?.enabled === false) continue;

      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;
      const isUnique = field.primaryKey || field.unique;
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      const queryProperties: Record<string, object> = {};
      if (!isUnique) {
        for (const [fName, f] of Object.entries(model.fields)) {
          Object.assign(queryProperties, buildFilterQueryProperties(fName, f));
        }
      }

      const bodyProperties: Record<string, object> = {};
      const allBodyFieldNames: string[] = [];

      for (const [otherName, otherField] of Object.entries(model.fields)) {
        if (otherName === fieldName) continue;
        bodyProperties[otherName] = {
          ...mapDataTypeToJsonSchema(otherField.type),
          description: `Updated value for ${otherName}`,
        };
        allBodyFieldNames.push(otherName);
      }

      const buildRouteSchema = (method: 'PATCH' | 'PUT') => {
        let finalBodySchema: Record<string, unknown>;

        if (model.validation) {
          finalBodySchema = {...model.validation};
          if (method === 'PATCH') {
            delete finalBodySchema.required;
          }
        } else {
          finalBodySchema = {
            type: 'object',
            properties: bodyProperties,
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
          summary: `${method === 'PATCH' ? 'Partial' : 'Complete'} edit of ${capitalizeFirstLetter(modelName)} record(s) by ${fieldName}`,
          description: `${method} update on records from the database by ${fieldName}`,
          tags: [capitalizeFirstLetter(modelName), 'Update'],
          params: {
            type: 'object',
            properties: {
              [fieldName]: {
                ...paramSchema,
                description: `The ${fieldName} value identifying the record to edit`,
              },
            },
            required: [fieldName],
            additionalProperties: false,
          },
          body: finalBodySchema,
          response: getResponseStructureSchema([200], responseDataSchema),
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
        const tableName = modelName;
        const body = request.body as ModelBody;

        delete body[fieldName];

        const keys = Object.keys(body);
        if (keys.length === 0) {
          return reply
            .status(400)
            .send({error: 'No fields provided for update'});
        }

        const values: unknown[] = [];
        let paramIndex = 1;

        const setClauses: string[] = [];
        for (const key of keys) {
          setClauses.push(`"${key}" = $${paramIndex++}`);
          values.push(body[key]);
        }

        const whereClauses: string[] = [];
        whereClauses.push(`"${fieldName}" = $${paramIndex++}`);
        values.push(params[fieldName]);

        if (!isUnique) {
          const {
            whereClauses: filterClauses,
            values: filterValues,
            nextParamIndex,
          } = applyFilters(queryParams, paramIndex, [fieldName]);

          whereClauses.push(...filterClauses);
          values.push(...filterValues);
          paramIndex = nextParamIndex;
        }

        const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

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
        `/${modelName}/${fieldName}/:${fieldName}`,
        {
          schema: buildRouteSchema('PATCH'),
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
        handleEditRequest,
      );

      app.put(
        `/${modelName}/${fieldName}/:${fieldName}`,
        {
          schema: buildRouteSchema('PUT'),
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
        handleEditRequest,
      );
    }
  }
}
