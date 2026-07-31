import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getApiAuthorization,
  getApiBypassSecret,
  getEffectiveQueries,
  shouldApiBeEnabled,
} from '@/lib/config/api';
import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/lib/config/identifier';
import {generateJSONValidationSchema} from '@/lib/schema/body';
import {buildAllQueryProperties} from '@/lib/schema/query';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {applyFilters} from '@/lib/sql/filters';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerSearchRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const searchableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis?.includes('search'),
    );

    for (const [fieldName, field] of searchableFields) {
      const defaultApiIdentifier = `model${getVariantSegment(config)}.${modelName}.${fieldName}.search`;

      if (!shouldApiBeEnabled(config, defaultApiIdentifier, modelName))
        continue;

      const defaultAuthorization = getApiAuthorization(
        config,
        defaultApiIdentifier,
      );
      const defaultBypassSecret = getApiBypassSecret(
        config,
        defaultApiIdentifier,
      );

      registerSearchEndpoint(
        app,
        config,
        modelName,
        fieldName,
        field,
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
        fieldName,
        'search',
      );
      const additionalVariants = getAdditionalVariants(config, baseIdentifier);

      for (const variant of additionalVariants) {
        const variantApiIdentifier = buildApiIdentifier(
          'model',
          variant,
          modelName,
          fieldName,
          'search',
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

        registerSearchEndpoint(
          app,
          config,
          modelName,
          fieldName,
          field,
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
}

function registerSearchEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  modelName: string,
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  authorization: boolean,
  routeTags?: string[],
  bypassSecret?: boolean,
): void {
  const schema: Record<string, unknown> = generateSchema(
    fieldName,
    field,
    model,
    modelName,
    config,
    authorization,
    apiIdentifier,
    routeTags,
    bypassSecret,
  );

  const path = `/${variant}/${modelName}/search/${fieldName}`;

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

      const searchTerm = String(queryParams[`${fieldName}_search`] || '');
      whereClauses.push(`LOWER("${fieldName}") LIKE $${paramIndex++}`);
      values.push(`%${searchTerm.toLowerCase()}%`);

      const {
        whereClauses: filterClauses,
        values: filterValues,
        nextParamIndex,
      } = applyFilters(queryParams, paramIndex, [`${fieldName}_search`]);

      whereClauses.push(...filterClauses);
      values.push(...filterValues);
      paramIndex = nextParamIndex;

      query += ` WHERE ${whereClauses.join(' AND ')}`;

      const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClauses.join(' AND ')}`;

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const countRes = await tx.query<{total: number | string}>(
          countQuery,
          values,
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
            `Successfully searched records from the ${tableName} table`,
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
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
  apiIdentifier: string,
  routeTags?: string[],
  bypassSecret?: boolean,
) {
  const effectiveQueries = getEffectiveQueries(config, apiIdentifier);
  const queryProperties: Record<string, object> = {
    [`${fieldName}_search`]: {
      type: 'string',
      description: `Search pattern to match against ${fieldName}`,
    },
    ...buildAllQueryProperties(model, effectiveQueries, bypassSecret),
  };

  const excludeSecret = !bypassSecret;
  const schema: Record<string, unknown> = {
    summary: `Search ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
    description: `Search ${modelName} records from the database using a LIKE pattern on ${fieldName}`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Read'],
    querystring: {
      type: 'object',
      properties: queryProperties,
      required: [`${fieldName}_search`],
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
      generateJSONValidationSchema(model, {excludeSecretFields: excludeSecret}),
    ),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
