import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiAuthorization, shouldApiBeEnabled} from '@/lib/config/api';
import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/lib/config/identifier';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {mapDataTypeToJsonSchema} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerDeleteRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const deletableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis?.includes('delete'),
    );

    for (const [fieldName, field] of deletableFields) {
      const defaultApiIdentifier = `model${getVariantSegment(config)}.${modelName}.${fieldName}.delete`;

      if (!shouldApiBeEnabled(config, defaultApiIdentifier, modelName))
        continue;

      const defaultAuthorization = getApiAuthorization(
        config,
        defaultApiIdentifier,
      );

      registerDeleteEndpoint(
        app,
        config,
        modelName,
        fieldName,
        field,
        model,
        defaultVariant,
        defaultApiIdentifier,
        defaultAuthorization,
      );

      const baseIdentifier = buildApiIdentifier(
        'model',
        defaultVariant,
        modelName,
        fieldName,
        'delete',
      );
      const additionalVariants = getAdditionalVariants(config, baseIdentifier);

      for (const variant of additionalVariants) {
        const variantApiIdentifier = buildApiIdentifier(
          'model',
          variant,
          modelName,
          fieldName,
          'delete',
        );

        if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

        const variantAuthorization = getApiAuthorization(
          config,
          variantApiIdentifier,
        );

        const variantTags = config.apis?.[variantApiIdentifier]?.tags;

        registerDeleteEndpoint(
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
        );
      }
    }
  }
}

function registerDeleteEndpoint(
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
): void {
  const schema: Record<string, unknown> = generateSchema(
    fieldName,
    field,
    model,
    modelName,
    config,
    authorization,
    routeTags,
  );

  const path = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;

  app.delete(
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
      const {[fieldName]: value} = request.params as Record<string, unknown>;

      const tableName = modelName;
      const columnName = fieldName;

      const query = `DELETE FROM "${tableName}" WHERE "${columnName}" = $1;`;

      let tx;
      try {
        tx = await app.db.beginTransaction();
        await tx.query(query, [value]);
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
  config: AppConfig,
  authorization: boolean,
  routeTags?: string[],
) {
  const paramSchema = mapDataTypeToJsonSchema(field.type);

  const schema: Record<string, unknown> = {
    summary: `Delete ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
    description: `Delete records from ${capitalizeFirstLetter(modelName)} table where ${fieldName} matches the provided value`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Delete'],
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

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
