import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {generateJSONValidationSchema} from '@/lib/schema/body';
import {buildAllQueryProperties} from '@/lib/schema/query';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {applyFilters} from '@/lib/sql/filters';

import {ModelConfig, ResolvedAppConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerGetAllRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const targets = getApiRouteTargets(
      config,
      'model',
      modelName,
      'unknown',
      'getAll',
    );

    for (const {identifier, variant, policy} of targets) {
      registerGetAllEndpoint(
        app,
        config,
        modelName,
        model,
        variant,
        identifier,
        policy,
      );
    }
  }
}

function registerGetAllEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  modelName: string,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    model,
    modelName,
    config,
    policy,
  );

  const path = `/${variant}/${modelName}/`;

  app.get(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, policy.authorization),
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

      const publicFields = getPublicFields(model, policy.bypassSecret);
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
  config: ResolvedAppConfig,
  policy: ResolvedApiPolicy,
) {
  const effectiveQueries = policy.supportedQueries;
  const queryProperties = buildAllQueryProperties(
    model,
    effectiveQueries,
    policy.bypassSecret,
  );
  const excludeSecret = !policy.bypassSecret;

  const schema: Record<string, unknown> = {
    summary: `Get all ${capitalizeFirstLetter(modelName)} records`,
    description: `Get all ${modelName} records from the database`,
    tags: policy.tags,
    querystring: {
      type: 'object',
      properties: queryProperties,
      additionalProperties: false,
    },
    response: getResponseStructureSchema([200], {
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
    }),
  };

  const security = buildSecurityArray(config, policy.authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
