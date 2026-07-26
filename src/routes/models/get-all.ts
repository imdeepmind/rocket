import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildAllQueryProperties,
  buildPreValidation,
  buildSecurityArray,
  generateJSONValidationSchema,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerGetAllRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const apiIdentifier = `model.${modelName}.all.getAll`;

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

    app.get(
      `/${modelName}/`,
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
        const tableName = modelName;

        let query = `SELECT * FROM "${tableName}"`;
        const values: unknown[] = [];
        let paramIndex = 1;

        const whereClauses: string[] = [];

        const {
          whereClauses: filterClauses,
          values: filterValues,
          nextParamIndex,
        } = applyFilters(queryParams, paramIndex);

        whereClauses.push(...filterClauses);
        values.push(...filterValues);
        paramIndex = nextParamIndex;

        if (whereClauses.length > 0) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;

        let tx;
        try {
          tx = await app.db.beginTransaction();

          const countRes = await tx.query<{total: number | string}>(
            countQuery,
            filterValues,
          );
          const total = Number(countRes.rows[0]?.total || 0);

          if (queryParams.orderBy) {
            query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
          }

          const page = Math.max(Number(queryParams.page) || 1, 1);
          const limit = Math.min(
            Math.max(Number(queryParams.limit) || 20, 10),
            100,
          );
          const offset = (page - 1) * limit;

          query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
          values.push(limit, offset);

          const res = await tx.query(query, values);

          await tx.commit();

          return reply.status(200).send(
            app.buildResponse(
              200,
              `Successfully retrieved records from the ${tableName} table`,
              {
                data: res.rows || [],
                pagination: {
                  page,
                  limit,
                  total,
                  totalPages: Math.ceil(total / limit),
                },
              },
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
function generateSchema(
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const queryProperties = buildAllQueryProperties(model);

  const schema: Record<string, unknown> = {
    summary: `Get all ${capitalizeFirstLetter(modelName)} records`,
    description: `Get all ${modelName} records from the database`,
    tags: [capitalizeFirstLetter(modelName), 'Read'],
    querystring: {
      type: 'object',
      properties: queryProperties,
      additionalProperties: false,
    },
    response: getResponseStructureSchema(
      [200],
      {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: generateJSONValidationSchema(model),
          },
          pagination: {
            type: 'object',
            properties: {
              page: {type: 'integer'},
              limit: {type: 'integer'},
              total: {type: 'integer'},
              totalPages: {type: 'integer'},
            },
          },
        },
      },
      generateJSONValidationSchema(model),
    ),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
