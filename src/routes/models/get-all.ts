import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildAllQueryProperties,
  buildPreValidation,
  buildSecurityArray,
  generateJSONValidationSchema,
  getApiAuthorization,
  getApiBypassSecret,
  getEffectiveQueries,
  getPublicFields,
  getResponseStructureSchema,
  shouldApiBeEnabled,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerGetAllRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const defaultApiIdentifier = `model${getVariantSegment(config)}.${modelName}.unknown.getAll`;

    if (!shouldApiBeEnabled(config, defaultApiIdentifier, modelName)) continue;

    const defaultAuthorization = getApiAuthorization(
      config,
      defaultApiIdentifier,
    );
    const defaultBypassSecret = getApiBypassSecret(
      config,
      defaultApiIdentifier,
    );

    registerGetAllEndpoint(
      app,
      config,
      modelName,
      model,
      defaultVariant,
      defaultApiIdentifier,
      defaultAuthorization,
      undefined,
      defaultBypassSecret,
    );

    const baseIdentifier = buildApiIdentifier(
      'model',
      defaultVariant,
      modelName,
      'unknown',
      'getAll',
    );
    const additionalVariants = getAdditionalVariants(config, baseIdentifier);

    for (const variant of additionalVariants) {
      const variantApiIdentifier = buildApiIdentifier(
        'model',
        variant,
        modelName,
        'unknown',
        'getAll',
      );

      if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

      const variantAuthorization = getApiAuthorization(
        config,
        variantApiIdentifier,
      );

      const variantTags = config.apis?.[variantApiIdentifier]?.tags;
      const variantBypassSecret = getApiBypassSecret(
        config,
        variantApiIdentifier,
      );

      registerGetAllEndpoint(
        app,
        config,
        modelName,
        model,
        variant,
        variantApiIdentifier,
        variantAuthorization,
        variantTags,
        variantBypassSecret,
      );
    }
  }
}

function registerGetAllEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  modelName: string,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  authorization: boolean,
  routeTags?: string[],
  bypassSecret?: boolean,
): void {
  const schema: Record<string, unknown> = generateSchema(
    model,
    modelName,
    config,
    authorization,
    apiIdentifier,
    routeTags,
    bypassSecret,
  );

  const path = `/${variant}/${modelName}/`;

  app.get(
    path,
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

      const publicFields = getPublicFields(model, bypassSecret);
      const columns = publicFields.map(([name]) => `"${name}"`).join(', ');
      let query = `SELECT ${columns} FROM "${tableName}"`;
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
function generateSchema(
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
  apiIdentifier: string,
  routeTags?: string[],
  bypassSecret?: boolean,
) {
  const effectiveQueries = getEffectiveQueries(config, apiIdentifier);
  const queryProperties = buildAllQueryProperties(
    model,
    effectiveQueries,
    bypassSecret,
  );
  const excludeSecret = !bypassSecret;

  const schema: Record<string, unknown> = {
    summary: `Get all ${capitalizeFirstLetter(modelName)} records`,
    description: `Get all ${modelName} records from the database`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Read'],
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
            items: generateJSONValidationSchema(model, {
              excludeSecretFields: excludeSecret,
            }),
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
      generateJSONValidationSchema(model, {
        excludeSecretFields: excludeSecret,
      }),
    ),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
