import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {ModelConfig, SupportedAggregationOperation} from '../schema/config';
import {getResponseStructureSchema} from './schema-helpers';
import {capitalizeFirstLetter} from '../utils/string';

/**
 * Register AGGREGATE routes for fields with supportedAggregation.
 *
 * For each model, for each field with non-empty supportedAggregation, creates:
 *   GET /{model}/aggregation/{columnName}
 *
 * Query params:
 *   - operations (string) — comma-separated list of aggregation operations to perform
 */
export function registerAggregateRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
): void {
  for (const model of models) {
    const aggregatableFields = model.fields.filter(
      f => f.supportedAggregation && f.supportedAggregation.length > 0,
    );

    for (const field of aggregatableFields) {
      const operations = field.supportedAggregation!;

      app.get(
        `/${model.name}/aggregation/${field.name}`,
        {
          schema: {
            summary: `Aggregate ${field.name} on ${capitalizeFirstLetter(model.name)}`,
            description: `Get aggregation data for ${field.name} in ${model.name}`,
            tags: [capitalizeFirstLetter(model.name), 'Read'],
            querystring: {
              type: 'object',
              properties: {
                operations: {
                  type: 'string',
                  description: `Comma-separated list of operations to perform: ${operations.join(', ')}`,
                },
              },
              required: ['operations'],
            },
            response: getResponseStructureSchema(
              [200],
              {
                type: 'object',
                properties: {
                  mean: {type: 'number', nullable: true},
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
            if (!operations.includes(op as SupportedAggregationOperation)) {
              return reply
                .status(400)
                .send(
                  app.buildResponse(
                    400,
                    `Unsupported aggregation operation '${op}' for field ${field.name}`,
                    null,
                  ),
                );
            }
          }

          const result: Record<string, unknown> = {};

          const sqlAggs = [];
          if (requestedOps.includes('mean'))
            sqlAggs.push(`AVG("${field.name}") AS mean`);
          if (requestedOps.includes('max'))
            sqlAggs.push(`MAX("${field.name}") AS max`);
          if (requestedOps.includes('min'))
            sqlAggs.push(`MIN("${field.name}") AS min`);
          if (requestedOps.includes('sum'))
            sqlAggs.push(`SUM("${field.name}") AS sum`);
          if (requestedOps.includes('count'))
            sqlAggs.push(`COUNT("${field.name}") AS count`);

          if (sqlAggs.length > 0) {
            const res = await app.db.query<Record<string, unknown>>(
              `SELECT ${sqlAggs.join(', ')} FROM "${model.name}"`,
            );
            if (res.rows.length > 0) {
              const row = res.rows[0];
              if (requestedOps.includes('mean')) result.mean = row.mean;
              if (requestedOps.includes('max')) result.max = row.max;
              if (requestedOps.includes('min')) result.min = row.min;
              if (requestedOps.includes('sum')) result.sum = row.sum;
              if (requestedOps.includes('count')) result.count = row.count;
            }
          }

          if (requestedOps.includes('frequency')) {
            const freqRes = await app.db.query<Record<string, unknown>>(
              `SELECT "${field.name}" as val, COUNT(*) as c FROM "${model.name}" GROUP BY "${field.name}"`,
            );
            const freq: Record<string, number> = {};
            for (const row of freqRes.rows) {
              freq[String(row.val)] = Number(row.c);
            }
            result.frequency = freq;
          }

          return reply
            .status(200)
            .send(
              app.buildResponse(
                200,
                `Successfully aggregated data for ${field.name} in ${model.name}`,
                result,
              ),
            );
        },
      );
    }
  }
}
