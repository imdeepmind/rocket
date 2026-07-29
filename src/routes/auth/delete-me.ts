import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {getVariantSegment} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerDeleteMeRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  const {model, idField} = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const apiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.deleteMe`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(model);

  app.delete(
    '/auth/user/me',
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
