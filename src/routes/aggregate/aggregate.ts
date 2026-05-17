import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {
  AppConfig,
  ModelConfig,
  ModelFieldConfig,
  SupportedAggregationOperation,
} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

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
  config: AppConfig,
): void {
  const {models} = config;

  for (const model of models) {
    // We only create an aggregation route for fields that have non-empty supportedAggregation
    // if a field is not aggregatable, we skip it
    const aggregatableFields = model.fields.filter(
      f => f.supportedAggregation && f.supportedAggregation.length > 0,
    );

    // for each aggregatable field, we create a GET route
    // /<model_name>/aggregation/<field_name>
    for (const field of aggregatableFields) {
      // construct the api identifier
      const apiIdentifier = `aggregateAPIs->${model.name}->${field.name}->getAggregation`;

      // calculating the authroization based on auth flag, it can be true
      // if the api level auth is enabled, or if the app level auth is enabled
      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.auth?.enableAuth ??
        false;

      const operations = field.supportedAggregation!;

      // generating the schema for the route
      const schema: Record<string, unknown> = generateSchema(
        config,
        field,
        model,
        operations,
        authorization,
      );

      app.get(
        `/${model.name}/aggregation/${field.name}`,
        {
          schema,
          config: {apiIdentifier},
          preValidation: async (request, reply) => {
            // doing validation here because we need the user for SSP
            if (config.auth?.enableAuth && authorization) {
              try {
                await request.jwtVerify();
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
          const query = request.query as Record<string, unknown>;
          // parsing the operations string into a clean array
          const requestedOps = String(query.operations || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          console.log({requestedOps});

          // validation: we must have at least one valid operation
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

          // validation: check if all requested operations are supported by this field's config
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

          // building the SQL for standard aggregations (mean, max, min, sum, count)
          // we consolidate these into a single query for efficiency
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

          // if we have any SQL aggregations to perform, execute the query
          if (sqlAggs.length > 0) {
            const res = await app.db.query<Record<string, unknown>>(
              `SELECT ${sqlAggs.join(', ')} FROM "${model.name}"`,
            );
            // map the database result columns back to our result object
            if (res.rows.length > 0) {
              const row = res.rows[0];
              if (requestedOps.includes('mean')) result.mean = row.mean;
              if (requestedOps.includes('max')) result.max = row.max;
              if (requestedOps.includes('min')) result.min = row.min;
              if (requestedOps.includes('sum')) result.sum = row.sum;
              if (requestedOps.includes('count')) result.count = row.count;
            }
          }

          // frequency is special because it requires a GROUP BY, so it's a separate query
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

          // sending the final aggregated response
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

function generateSchema(
  config: AppConfig,
  field: ModelFieldConfig,
  model: ModelConfig,
  operations: SupportedAggregationOperation[],
  authorization: boolean,
) {
  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  // defining the swagger/ajv validation schema for the route
  const schema: Record<string, unknown> = {
    summary: `Aggregate ${field.name} on ${capitalizeFirstLetter(model.name)}`,
    description: `Get aggregation data for ${field.name} in ${model.name}`,
    tags: [capitalizeFirstLetter(model.name), 'Read'],
    querystring: {
      type: 'object',
      properties: {
        // users can pass a comma-separated list of operations like ?operations=mean,max,min
        operations: {
          type: 'string',
          description: `Comma-separated list of operations to perform: ${operations.join(', ')}`,
        },
      },
      required: ['operations'],
      additionalProperties: false,
    },
    // generating the response structure based on common aggregation keys
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
  };

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
