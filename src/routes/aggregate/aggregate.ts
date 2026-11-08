import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {Aggregation, ResolvedAppConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerAggregateRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const aggregatableFields = Object.entries(model.fields).filter(
      ([, f]) => f.aggregations.length > 0,
    );

    for (const [fieldName, field] of aggregatableFields) {
      const targets = getApiRouteTargets(
        config,
        'aggregate',
        modelName,
        fieldName,
        'getAggregation',
      );

      for (const {identifier, variant, policy} of targets) {
        const aggregations = policy.supportedAggregations ?? field.aggregations;

        registerAggregateEndpoint(
          app,
          config,
          modelName,
          fieldName,
          aggregations,
          variant,
          identifier,
          policy,
        );
      }
    }
  }
}

/**
 * Register a single aggregate endpoint for a specific variant
 */
function registerAggregateEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  modelName: string,
  fieldName: string,
  aggregations: Aggregation[],
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  // Build path with variant prefix
  const path = `/${variant}/${modelName}/aggregation/${fieldName}`;

  const schema: Record<string, unknown> = generateSchema(
    config,
    fieldName,
    modelName,
    aggregations,
    policy,
  );

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
      const query = request.query as Record<string, unknown>;
      const requestedOps = String(query.operations || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (requestedOps.length === 0) {
        return reply
          .status(400)
          .send(
            app.buildResponse(
              400,
              'At least one aggregation operation must be provided',
              null,
            ),
          );
      }

      for (const op of requestedOps) {
        if (!aggregations.includes(op as Aggregation)) {
          return reply
            .status(400)
            .send(
              app.buildResponse(
                400,
                `Unsupported aggregation operation '${op}' for field ${fieldName}`,
                null,
              ),
            );
        }
      }

      const result: Record<string, unknown> = {};

      const sqlAggs: string[] = [];
      if (requestedOps.includes('avg'))
        sqlAggs.push(`AVG("${fieldName}") AS avg`);
      if (requestedOps.includes('max'))
        sqlAggs.push(`MAX("${fieldName}") AS max`);
      if (requestedOps.includes('min'))
        sqlAggs.push(`MIN("${fieldName}") AS min`);
      if (requestedOps.includes('sum'))
        sqlAggs.push(`SUM("${fieldName}") AS sum`);
      if (requestedOps.includes('count'))
        sqlAggs.push(`COUNT("${fieldName}") AS count`);

      let tx;
      try {
        tx = await app.db.beginTransaction();

        if (sqlAggs.length > 0) {
          const res = await tx.query<Record<string, unknown>>(
            `SELECT ${sqlAggs.join(', ')} FROM "${modelName}"`,
          );
          if (res.rows.length > 0) {
            const row = res.rows[0];
            if (requestedOps.includes('avg')) result.avg = row.avg;
            if (requestedOps.includes('max')) result.max = row.max;
            if (requestedOps.includes('min')) result.min = row.min;
            if (requestedOps.includes('sum')) result.sum = row.sum;
            if (requestedOps.includes('count')) result.count = row.count;
          }
        }

        if (requestedOps.includes('frequency')) {
          const freqRes = await tx.query<Record<string, unknown>>(
            `SELECT "${fieldName}" as val, COUNT(*) as c FROM "${modelName}" GROUP BY "${fieldName}"`,
          );
          const freq: Record<string, number> = {};
          for (const row of freqRes.rows) {
            freq[String(row.val)] = Number(row.c);
          }
          result.frequency = freq;
        }

        await tx.commit();

        return reply
          .status(200)
          .send(
            app.buildResponse(
              200,
              `Successfully aggregated data for ${fieldName} in ${modelName}`,
              result,
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
  config: ResolvedAppConfig,
  fieldName: string,
  modelName: string,
  aggregations: Aggregation[],
  policy: ResolvedApiPolicy,
) {
  const security = buildSecurityArray(config, policy.authorization);

  const schema: Record<string, unknown> = {
    summary: `Aggregate ${fieldName} on ${capitalizeFirstLetter(modelName)}`,
    description: `Get aggregation data for ${fieldName} in ${modelName}`,
    tags: policy.tags,
    querystring: {
      type: 'object',
      properties: {
        operations: {
          type: 'string',
          description: `Comma-separated list of operations to perform: ${aggregations.join(', ')}`,
        },
      },
      required: ['operations'],
      additionalProperties: false,
    },
    response: getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        avg: {type: 'number', nullable: true},
        max: {type: 'number', nullable: true},
        min: {type: 'number', nullable: true},
        sum: {type: 'number', nullable: true},
        count: {type: 'number', nullable: true},
        frequency: {
          type: 'object',
          additionalProperties: {type: 'integer'},
        },
      },
    }),
  };

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
