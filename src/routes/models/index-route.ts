import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildAllQueryProperties,
  buildPreValidation,
  buildSecurityArray,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
  shouldApiBeEnabled,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {getVariantSegment} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

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
      const apiIdentifier = `model${getVariantSegment(config)}.${modelName}.${fieldName}.index`;

      if (!shouldApiBeEnabled(config, apiIdentifier, modelName)) continue;

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
          preValidation: buildPreValidation(app, config, authorization),
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

          query += ` WHERE ${whereClauses.join(' AND ')}`;

          let tx;
          try {
            tx = await app.db.beginTransaction();

            let total = 0;
            if (!isUnique) {
              const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClauses.join(' AND ')}`;
              const countRes = await tx.query<{total: number | string}>(
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

            const res = await tx.query(query, values);

            await tx.commit();

            const responsePayload: Record<string, unknown> = {
              data: isUnique ? res.rows[0] || null : res.rows || [],
            };

            if (!isUnique) {
              responsePayload.pagination = {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              };
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
          } catch (err) {
            if (tx) await tx.rollback().catch(() => {});
            throw err;
          } finally {
            tx?.release();
          }
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

  const queryProperties = isUnique ? {} : buildAllQueryProperties(model);

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
        totalPages: {type: 'integer'},
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

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return {schema, isUnique};
}
