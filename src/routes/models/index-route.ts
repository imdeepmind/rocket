import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register INDEX routes for indexed fields.
 *
 * For each model, for each field with primaryKey, unique, or 'index' in apis, creates:
 *   GET /{model}/{columnName}/:value
 *
 * Includes filter query params based on the model's operations,
 * as well as sorting and pagination, ONLY if the field is not unique.
 */
export function registerIndexRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const indexFields = Object.entries(model.fields).filter(([, f]) => {
      return f.primaryKey || f.unique || f.apis?.includes('index');
    });

    for (const [fieldName, field] of indexFields) {
      const apiIdentifier = `modelAPIs.${modelName}.${fieldName}.index`;

      if (config.apis?.[apiIdentifier]?.enabled === false) continue;

      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;
      const {
        schema,
        isUnique,
      }: {schema: Record<string, unknown>; isUnique: boolean | undefined} =
        generateSchema(
          fieldName,
          field,
          model,
          modelName,
          config,
          authorization,
        );

      app.get(
        `/${modelName}/${fieldName}/:${fieldName}`,
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
        async (request: FastifyRequest, reply: FastifyReply) => {
          const queryParams = request.query as Record<string, unknown>;
          const params = request.params as Record<string, unknown>;
          const tableName = modelName;

          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          whereClauses.push(`"${fieldName}" = $${paramIndex++}`);
          values.push(params[fieldName]);

          if (!isUnique) {
            const {
              whereClauses: filterClauses,
              values: filterValues,
              nextParamIndex,
            } = applyFilters(queryParams, paramIndex);

            whereClauses.push(...filterClauses);
            values.push(...filterValues);
            paramIndex = nextParamIndex;
          }

          if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          let total = 0;
          if (!isUnique) {
            const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
            const countRes = await app.db.query<{total: number | string}>(
              countQuery,
              values,
            );
            total = Number(countRes.rows[0]?.total || 0);
          }

          let page = 1;
          let limit = 20;

          if (!isUnique) {
            if (queryParams.orderBy) {
              query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
            }

            page = Math.max(Number(queryParams.page) || 1, 1);
            limit = Math.min(
              Math.max(Number(queryParams.limit) || 20, 10),
              100,
            );
            const offset = (page - 1) * limit;

            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
            values.push(limit, offset);
          } else {
            query += ` LIMIT $${paramIndex++};`;
            values.push(1);
          }

          const res = await app.db.query(query, values);

          const responsePayload: Record<string, unknown> = {
            data: isUnique ? res.rows[0] || null : res.rows || [],
          };

          if (!isUnique) {
            responsePayload.pagination = {page, limit, total};
          }

          return reply
            .status(200)
            .send(
              app.buildResponse(
                200,
                `Successfully retrieved records from the ${tableName} table`,
                responsePayload,
                res,
              ),
            );
        },
      );
    }
  }
}

function generateSchema(
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const isUnique = field.primaryKey || field.unique;
  const fieldSchemaType = mapDataTypeToJsonSchema(field.type);

  const queryProperties: Record<string, object> = {};

  if (!isUnique) {
    for (const [fName, f] of Object.entries(model.fields)) {
      Object.assign(queryProperties, buildFilterQueryProperties(fName, f));
    }

    const sortableFields = Object.entries(model.fields)
      .filter(([, f]) => f.query?.includes('sort'))
      .map(([fName]) => fName);
    Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

    Object.assign(queryProperties, paginationQueryProperties);
  }

  const responseSchemaProperties: Record<string, object> = {
    data: isUnique
      ? {...generateJSONValidationSchema(model), nullable: true}
      : {type: 'array', items: generateJSONValidationSchema(model)},
  };

  if (!isUnique) {
    responseSchemaProperties.pagination = {
      type: 'object',
      properties: {
        page: {type: 'integer'},
        limit: {type: 'integer'},
        total: {type: 'integer'},
      },
    };
  }

  const schema: Record<string, unknown> = {
    summary: `Get ${capitalizeFirstLetter(modelName)} record(s) by ${fieldName}`,
    description: `Get ${modelName} record(s) from the database by ${fieldName}`,
    tags: [capitalizeFirstLetter(modelName), 'Read'],
    params: {
      type: 'object',
      properties: {
        [fieldName]: {
          ...fieldSchemaType,
          description: `The ${fieldName} value to look up`,
        },
      },
      required: [fieldName],
    },
    response: getResponseStructureSchema(
      [200],
      {
        type: 'object',
        properties: responseSchemaProperties,
      },
      generateJSONValidationSchema(model),
    ),
  };

  if (Object.keys(queryProperties).length > 0) {
    schema.querystring = {
      type: 'object',
      properties: queryProperties,
      additionalProperties: false,
    };
  }

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
  return {schema, isUnique};
}
