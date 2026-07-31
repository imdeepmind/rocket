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
import {buildAllQueryProperties} from '@/lib/schema/query';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields, mapDataTypeToJsonSchema} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {applyFilters} from '@/lib/sql/filters';

import {
  AppConfig,
  ModelBody,
  ModelConfig,
  ModelFieldConfig,
} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerEditRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const editableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis?.includes('edit'),
    );

    for (const [fieldName, field] of editableFields) {
      const defaultApiIdentifier = `model${getVariantSegment(config)}.${modelName}.${fieldName}.edit`;

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

      registerEditEndpoint(
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
        'edit',
      );
      const additionalVariants = getAdditionalVariants(config, baseIdentifier);

      for (const variant of additionalVariants) {
        const variantApiIdentifier = buildApiIdentifier(
          'model',
          variant,
          modelName,
          fieldName,
          'edit',
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

        registerEditEndpoint(
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

function registerEditEndpoint(
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
  const isUnique = field.primaryKey || field.unique;
  const paramSchema = mapDataTypeToJsonSchema(field.type);

  const effectiveQueries = getEffectiveQueries(config, apiIdentifier);
  const queryProperties = isUnique
    ? {}
    : buildAllQueryProperties(model, effectiveQueries, bypassSecret);

  const bodyProperties: Record<string, object> = {};
  const allBodyFieldNames: string[] = [];

  for (const [otherName, otherField] of Object.entries(model.fields)) {
    if (otherName === fieldName) continue;
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
    getPublicFields(model, bypassSecret).map(([name]) => name),
  );

  const buildRouteSchema = (method: 'PATCH' | 'PUT') => {
    let finalBodySchema: Record<string, unknown>;

    if (model.validation) {
      finalBodySchema = {...model.validation};
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
      tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Update'],
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

    const security = buildSecurityArray(config, authorization);

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
            res,
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
      preValidation: buildPreValidation(app, config, authorization),
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
      preValidation: buildPreValidation(app, config, authorization),
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
