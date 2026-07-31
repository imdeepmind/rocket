import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getApiAuthorization,
  getApiBypassSecret,
  shouldApiBeEnabled,
} from '@/lib/config/api';
import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/lib/config/identifier';
import {
  generateJSONValidationSchema,
  stripAdditionalPostFields,
} from '@/lib/schema/body';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {getPublicFields} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {AppConfig, ModelBody, ModelConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerPostRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [modelName, model] of Object.entries(models)) {
    const defaultApiIdentifier = `model${getVariantSegment(config)}.${modelName}.unknown.insert`;

    if (!shouldApiBeEnabled(config, defaultApiIdentifier, modelName)) continue;

    const defaultAuthorization = getApiAuthorization(
      config,
      defaultApiIdentifier,
    );
    const defaultBypassSecret = getApiBypassSecret(
      config,
      defaultApiIdentifier,
    );

    registerPostEndpoint(
      app,
      config,
      modelName,
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
      'unknown',
      'insert',
    );
    const additionalVariants = getAdditionalVariants(config, baseIdentifier);

    for (const variant of additionalVariants) {
      const variantApiIdentifier = buildApiIdentifier(
        'model',
        variant,
        modelName,
        'unknown',
        'insert',
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

      registerPostEndpoint(
        app,
        config,
        modelName,
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

function registerPostEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  modelName: string,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  authorization: boolean,
  routeTags?: string[],
  bypassSecret?: boolean,
): void {
  const schema: Record<string, unknown> = generateSchema(
    model,
    modelName,
    config,
    authorization,
    routeTags,
    bypassSecret,
  );

  const path = `/${variant}/${modelName}/`;

  app.post(
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
      const tableName = modelName;
      const incomingBody = request.body as ModelBody;

      const body = stripAdditionalPostFields(model, incomingBody, {
        ignorePrimaryKey: true,
      });

      const publicFieldNames = new Set(
        getPublicFields(model, bypassSecret).map(([name]) => name),
      );
      const responseBody: ModelBody = {};
      for (const [key, value] of Object.entries(body)) {
        if (publicFieldNames.has(key)) {
          responseBody[key] = value;
        }
      }

      const keys = Object.keys(body);
      const values = Object.values(body);

      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;

      let tx;
      try {
        tx = await app.db.beginTransaction();
        const res = await tx.query(query, values);
        await tx.commit();

        return reply
          .status(201)
          .send(
            app.buildResponse(
              201,
              `Successfully added the new entry to the ${tableName} table`,
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
    },
  );
}
function generateSchema(
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
  routeTags?: string[],
  bypassSecret?: boolean,
) {
  const bodySchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
  });

  const responseSchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
    excludeSecretFields: !bypassSecret,
  });

  const schema: Record<string, unknown> = {
    summary: `Create a new ${capitalizeFirstLetter(modelName)} record`,
    description: `Create a new ${capitalizeFirstLetter(modelName)} record in the database`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Insert'],
    body: bodySchema,
    response: getResponseStructureSchema([201], responseSchema, responseSchema),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
