import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  buildSecurityArray,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  shouldApiBeEnabled,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, ModelConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
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

    const defaultAuthorization =
      config.apis?.[defaultApiIdentifier]?.authorization ??
      config.authentication?.enabled ??
      false;

    registerPostEndpoint(
      app,
      config,
      modelName,
      model,
      defaultVariant,
      defaultApiIdentifier,
      defaultAuthorization,
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

      const variantAuthorization =
        config.apis?.[variantApiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;

      const variantTags = config.apis?.[variantApiIdentifier]?.tags;

      registerPostEndpoint(
        app,
        config,
        modelName,
        model,
        variant,
        variantApiIdentifier,
        variantAuthorization,
        variantTags,
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
): void {
  const schema: Record<string, unknown> = generateSchema(
    model,
    modelName,
    config,
    authorization,
    routeTags,
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
              body,
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
) {
  const bodySchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
  });

  const schema: Record<string, unknown> = {
    summary: `Create a new ${capitalizeFirstLetter(modelName)} record`,
    description: `Create a new ${capitalizeFirstLetter(modelName)} record in the database`,
    tags: routeTags ?? [capitalizeFirstLetter(modelName), 'Insert'],
    body: bodySchema,
    response: getResponseStructureSchema([201], bodySchema, bodySchema),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
