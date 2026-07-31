import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  buildSecurityArray,
  getApiAuthorization,
  getEffectiveAggregations,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {Aggregation, AppConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerAggregateRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const aggregatableFields = Object.entries(model.fields).filter(
      ([, f]) => f.aggregations && f.aggregations.length > 0,
    );

    for (const [fieldName, field] of aggregatableFields) {
      // Register default variant endpoint
      const defaultApiIdentifier = `aggregate${getVariantSegment(config)}.${modelName}.${fieldName}.getAggregation`;

      if (config.apis?.[defaultApiIdentifier]?.enabled !== false) {
        const defaultAuthorization = getApiAuthorization(
          config,
          defaultApiIdentifier,
        );
        const defaultTags = config.apis?.[defaultApiIdentifier]?.tags;
        const defaultAggregations =
          getEffectiveAggregations(config, defaultApiIdentifier) ??
          field.aggregations!;

        registerAggregateEndpoint(
          app,
          config,
          modelName,
          fieldName,
          defaultAggregations,
          defaultVariant,
          defaultApiIdentifier,
          defaultAuthorization,
          defaultTags,
        );
      }

      // Register additional variant endpoints
      const baseIdentifier = buildApiIdentifier(
        'aggregate',
        defaultVariant,
        modelName,
        fieldName,
        'getAggregation',
      );
      const additionalVariants = getAdditionalVariants(config, baseIdentifier);

      for (const variant of additionalVariants) {
        const variantApiIdentifier = buildApiIdentifier(
          'aggregate',
          variant,
          modelName,
          fieldName,
          'getAggregation',
        );

        if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

        const variantAuthorization = getApiAuthorization(
          config,
          variantApiIdentifier,
        );

        const variantTags = config.apis?.[variantApiIdentifier]?.tags;
        const variantAggregations =
          getEffectiveAggregations(config, variantApiIdentifier) ??
          field.aggregations!;

        registerAggregateEndpoint(
          app,
          config,
          modelName,
          fieldName,
          variantAggregations,
          variant,
          variantApiIdentifier,
          variantAuthorization,
          variantTags,
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
  config: AppConfig,
  modelName: string,
  fieldName: string,
  aggregations: Aggregation[],
  variant: string,
  apiIdentifier: string,
  authorization: boolean,
  routeTags?: string[],
): void {
  // Build path with variant prefix
  const path = `/${variant}/${modelName}/aggregation/${fieldName}`;

  const schema: Record<string, unknown> = generateSchema(
    config,
    fieldName,
    modelName,
    aggregations,
    authorization,
    routeTags,
  );

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
  config: AppConfig,
  fieldName: string,
  modelName: string,
  aggregations: Aggregation[],
  authorization: boolean,
  routeTags?: string[],
) {
  const security = buildSecurityArray(config, authorization);

  const schema: Record<string, unknown> = {
    summary: `Aggregate ${fieldName} on ${capitalizeFirstLetter(modelName)}`,
    description: `Get aggregation data for ${fieldName} in ${modelName}`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Read'],
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
    response: getResponseStructureSchema(
      [200],
      {
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
      },
      {type: 'object', additionalProperties: true},
    ),
  };

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
