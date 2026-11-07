import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
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

import {ModelBody, ModelConfig, ResolvedAppConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerPostRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const targets = getApiRouteTargets(
      config,
      'model',
      modelName,
      'unknown',
      'insert',
    );

    for (const {identifier, variant, policy} of targets) {
      registerPostEndpoint(
        app,
        config,
        modelName,
        model,
        variant,
        identifier,
        policy,
      );
    }
  }
}
function registerPostEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  modelName: string,
  model: ModelConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    model,
    modelName,
    config,
    policy,
  );

  const path = `/${variant}/${modelName}/`;

  app.post(
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
      const tableName = modelName;
      const incomingBody = request.body as ModelBody;

      const body = stripAdditionalPostFields(model, incomingBody, {
        ignorePrimaryKey: true,
      });

      const publicFieldNames = new Set(
        getPublicFields(model, policy.bypassSecret).map(([name]) => name),
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
        await tx.query(query, values);
        await tx.commit();

        return reply
          .status(201)
          .send(
            app.buildResponse(
              201,
              `Successfully added the new entry to the ${tableName} table`,
              responseBody,
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
  config: ResolvedAppConfig,
  policy: ResolvedApiPolicy,
) {
  const bodySchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
    excludeTimestamps: true,
  });

  const responseSchema = generateJSONValidationSchema(model, {
    ignorePrimaryKey: true,
    additionalProperties: false,
    excludeSecretFields: !policy.bypassSecret,
    excludeTimestamps: true,
  });

  const schema: Record<string, unknown> = {
    summary: `Create a new ${capitalizeFirstLetter(modelName)} record`,
    description: `Create a new ${capitalizeFirstLetter(modelName)} record in the database`,
    tags: policy.tags,
    body: bodySchema,
    response: getResponseStructureSchema([201], responseSchema),
  };

  const security = buildSecurityArray(config, policy.authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
