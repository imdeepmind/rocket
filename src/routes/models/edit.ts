import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {stripManagedTimestampProperties} from '@/lib/schema/body';
import {isManagedTimestampField} from '@/lib/schema/fields';
import {buildAllQueryProperties} from '@/lib/schema/query';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields, mapDataTypeToJsonSchema} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {applyFilters} from '@/lib/sql/filters';
import {buildUpdatedAtClause} from '@/lib/sql/timestamps';

import {
  ModelBody,
  ModelConfig,
  ModelFieldConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerEditRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const editableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis.includes('edit'),
    );

    for (const [fieldName, field] of editableFields) {
      const targets = getApiRouteTargets(
        config,
        'model',
        modelName,
        fieldName,
        'edit',
      );

      for (const {identifier, variant, policy} of targets) {
        registerEditEndpoint(
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

function registerEditEndpoint(
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
  const isUnique = field.primaryKey || field.unique;
  const paramSchema = mapDataTypeToJsonSchema(field.type);

  const effectiveQueries = policy.supportedQueries;
  const queryProperties = isUnique
    ? {}
    : buildAllQueryProperties(model, effectiveQueries, policy.bypassSecret);

  const bodyProperties: Record<string, object> = {};
  const allBodyFieldNames: string[] = [];

  for (const [otherName, otherField] of Object.entries(model.fields)) {
    if (otherName === fieldName || isManagedTimestampField(otherName)) continue;
    bodyProperties[otherName] = {
      ...mapDataTypeToJsonSchema(otherField.type),
      ...(otherField.type === 'enum' && otherField.values
        ? {enum: otherField.values}
        : {}),
      description: `Updated value for ${otherName}`,
    };
    allBodyFieldNames.push(otherName);
  }

  const publicFieldNames = new Set(
    getPublicFields(model, policy.bypassSecret).map(([name]) => name),
  );

  const buildRouteSchema = (method: 'PATCH' | 'PUT') => {
    let finalBodySchema: Record<string, unknown>;

    if (model.validation) {
      finalBodySchema = {...model.validation};
      stripManagedTimestampProperties(finalBodySchema);
      if (method === 'PATCH') {
        delete finalBodySchema.required;
      }
    } else {
      finalBodySchema = {
        type: 'object',
        properties: bodyProperties,
        required: method === 'PUT' ? allBodyFieldNames : [],
        additionalProperties: false,
      };
    }

    const responseDataSchema = {
      ...finalBodySchema,
      properties: Object.fromEntries(
        Object.entries(
          (finalBodySchema.properties as Record<string, object>) || {},
        ).filter(([name]) => publicFieldNames.has(name)),
      ),
    } as Record<string, unknown>;
    if (method === 'PATCH' && responseDataSchema.required) {
      delete responseDataSchema.required;
    }

    const schema: Record<string, unknown> = {
      summary: `${method === 'PATCH' ? 'Partial' : 'Complete'} edit of ${capitalizeFirstLetter(modelName)} record(s) by ${fieldName}`,
      description: `${method} update on records from the database by ${fieldName}`,
      tags: policy.tags,
      params: {
        type: 'object',
        properties: {
          [fieldName]: {
            ...paramSchema,
            description: `The ${fieldName} value identifying the record to edit`,
          },
        },
        required: [fieldName],
        additionalProperties: false,
      },
      body: finalBodySchema,
      response: getResponseStructureSchema([200], responseDataSchema),
    };

    const security = buildSecurityArray(config, policy.authorization);

    if (security.length > 0) {
      schema.security = security;
    }

    if (Object.keys(queryProperties).length > 0) {
      schema.querystring = {
        type: 'object',
        properties: queryProperties,
        additionalProperties: false,
      };
    }

    return schema;
  };

  const handleEditRequest = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const queryParams = request.query as Record<string, unknown>;
    const params = request.params as Record<string, unknown>;
    const tableName = modelName;
    const body = request.body as ModelBody;

    delete body[fieldName];

    for (const key of Object.keys(body)) {
      if (isManagedTimestampField(key)) {
        delete body[key];
      }
    }

    const updatedAtClause = buildUpdatedAtClause(
      model,
      config.infrastructure.database.engine,
    );

    const keys = Object.keys(body);
    if (keys.length === 0) {
      return reply.status(400).send({error: 'No fields provided for update'});
    }

    const values: unknown[] = [];
    let paramIndex = 1;

    const setClauses: string[] = [];
    for (const key of keys) {
      setClauses.push(`"${key}" = $${paramIndex++}`);
      values.push(body[key]);
    }
    if (updatedAtClause) {
      setClauses.push(updatedAtClause);
    }

    const whereClauses: string[] = [];
    whereClauses.push(`"${fieldName}" = $${paramIndex++}`);
    values.push(params[fieldName]);

    if (!isUnique) {
      const {
        whereClauses: filterClauses,
        values: filterValues,
        nextParamIndex,
      } = applyFilters(queryParams, paramIndex, [fieldName]);

      whereClauses.push(...filterClauses);
      values.push(...filterValues);
      paramIndex = nextParamIndex;
    }

    const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    const responseBody: ModelBody = {};
    for (const [key, value] of Object.entries(body)) {
      if (publicFieldNames.has(key)) {
        responseBody[key] = value;
      }
    }

    let tx;
    try {
      tx = await app.db.beginTransaction();
      const res = await tx.query(query, values);
      await tx.commit();

      const affected = res.changes;

      if (affected !== undefined && affected === 0) {
        return reply
          .status(404)
          .send(
            app.buildResponse(
              404,
              `No ${tableName} record found matching the given criteria`,
              null,
            ),
          );
      }

      return reply
        .status(200)
        .send(
          app.buildResponse(
            200,
            `Successfully updated records in the ${tableName} table`,
            responseBody,
          ),
        );
    } catch (err) {
      if (tx) await tx.rollback().catch(() => {});
      throw err;
    } finally {
      tx?.release();
    }
  };

  const basePath = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;

  app.patch(
    basePath,
    {
      schema: buildRouteSchema('PATCH'),
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, policy.authorization),
      preHandler: async request => {
        await app.callWebhook('request', request, null);
      },
      onSend: async (request, _, payload) => {
        await app.callWebhook('response', request, payload);
      },
    },
    handleEditRequest,
  );

  app.put(
    basePath,
    {
      schema: buildRouteSchema('PUT'),
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, policy.authorization),
      preHandler: async request => {
        await app.callWebhook('request', request, null);
      },
      onSend: async (request, _, payload) => {
        await app.callWebhook('response', request, payload);
      },
    },
    handleEditRequest,
  );
}
