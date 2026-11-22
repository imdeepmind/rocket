import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {buildFilterQueryProperties} from '@/lib/schema/query';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields, mapDataTypeToJsonSchema} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {applyFilters} from '@/lib/sql/filters';

import {
  ModelConfig,
  ModelFieldConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerDeleteRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const deletableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis.includes('delete'),
    );

    for (const [fieldName, field] of deletableFields) {
      const targets = getApiRouteTargets(
        config,
        'model',
        modelName,
        fieldName,
        'delete',
      );

      for (const {identifier, variant, policy} of targets) {
        registerDeleteEndpoint(
          app,
          config,
          modelName,
          fieldName,
          field,
          model,
          variant,
          identifier,
          policy,
        );
      }
    }
  }
}
function registerDeleteEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  modelName: string,
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    fieldName,
    field,
    model,
    modelName,
    config,
    policy,
  );

  const path = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;

  app.delete(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(
        app,
        config,
        policy.authorization,
        policy.roles,
      ),
      preHandler: async request => {
        await app.callWebhook('request', request, null);
      },
      onSend: async (request, _, payload) => {
        await app.callWebhook('response', request, payload);
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {[fieldName]: value} = request.params as Record<string, unknown>;
      const queryParams = request.query as Record<string, unknown>;

      const tableName = modelName;
      const columnName = fieldName;

      const whereClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      whereClauses.push(`"${columnName}" = $${paramIndex++}`);
      values.push(value);

      const {
        whereClauses: filterClauses,
        values: filterValues,
        nextParamIndex,
      } = applyFilters(queryParams, paramIndex, [fieldName]);

      whereClauses.push(...filterClauses);
      values.push(...filterValues);
      paramIndex = nextParamIndex;

      const query = `DELETE FROM "${tableName}" WHERE ${whereClauses.join(' AND ')};`;

      let tx;
      try {
        tx = await app.db.beginTransaction();
        await tx.query(query, values);
        await tx.commit();
      } catch (err) {
        if (tx) await tx.rollback().catch(() => {});
        throw err;
      } finally {
        tx?.release();
      }

      return reply.status(204).send();
    },
  );
}

function generateSchema(
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  modelName: string,
  config: ResolvedAppConfig,
  policy: ResolvedApiPolicy,
) {
  const paramSchema = mapDataTypeToJsonSchema(field.type);

  const effectiveQueries = policy.supportedQueries;
  const queryProperties: Record<string, object> = {};
  const fields = policy.bypassSecret
    ? Object.entries(model.fields)
    : getPublicFields(model);

  for (const [fName, f] of fields) {
    if (fName === fieldName) continue;
    Object.assign(
      queryProperties,
      buildFilterQueryProperties(fName, f, effectiveQueries),
    );
  }

  const schema: Record<string, unknown> = {
    summary: `Delete ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
    description: `Delete records from ${capitalizeFirstLetter(modelName)} table where ${fieldName} matches the provided value`,
    tags: policy.tags,
    params: {
      type: 'object',
      properties: {
        [fieldName]: {
          ...paramSchema,
          description: `The ${fieldName} value identifying the record to delete`,
        },
      },
      required: [fieldName],
      additionalProperties: false,
    },
    response: getResponseStructureSchema([204], {}),
  };

  if (Object.keys(queryProperties).length > 0) {
    schema.querystring = {
      type: 'object',
      properties: queryProperties,
      additionalProperties: false,
    };
  }

  const security = buildSecurityArray(config, policy.authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
