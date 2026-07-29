import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerDeleteMeRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const {model, idField} = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const defaultApiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.deleteMe`;

  if (config.apis?.[defaultApiIdentifier]?.enabled === false) return;

  registerDeleteMeEndpoint(
    app,
    config,
    model,
    idField,
    defaultVariant,
    defaultApiIdentifier,
  );

  const baseIdentifier = buildApiIdentifier(
    'auth',
    defaultVariant,
    model,
    'unknown',
    'deleteMe',
  );
  const additionalVariants = getAdditionalVariants(config, baseIdentifier);

  for (const variant of additionalVariants) {
    const variantApiIdentifier = buildApiIdentifier(
      'auth',
      variant,
      model,
      'unknown',
      'deleteMe',
    );

    if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

    registerDeleteMeEndpoint(
      app,
      config,
      model,
      idField,
      variant,
      variantApiIdentifier,
    );
  }
}

function registerDeleteMeEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  model: string,
  idField: string,
  variant: string,
  apiIdentifier: string,
): void {
  const schema: Record<string, unknown> = generateSchema(model);

  const path = `/${variant}/auth/user/me`;

  app.delete(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true, ['auth']),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userPayload = request.user as Record<string, unknown>;
      const userId = userPayload.id;

      if (!userId) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'User ID missing in token payload', null),
          );
      }

      const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const res = await tx.query(selectQuery, [userId]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 404,
            body: app.buildResponse(404, 'User not found', null),
          });
        }

        const deleteQuery = `DELETE FROM "${model}" WHERE "${idField}" = $1;`;
        await tx.query(deleteQuery, [userId]);

        await tx.commit();

        return reply.status(200).send(
          app.buildResponse(200, 'User profile deleted successfully', {
            success: true,
          }),
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

function generateSchema(model: string) {
  const responseSchema = getResponseStructureSchema([200], {
    type: 'object',
    properties: {
      success: {type: 'boolean'},
    },
  });

  const schema: Record<string, unknown> = {
    summary: `Delete authenticated user profile for ${capitalizeFirstLetter(model)}`,
    description: `Permanently deletes the currently authenticated user from the "${model}" table.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Profile'],
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
