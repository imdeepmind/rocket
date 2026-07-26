import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {compare, hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerChangePasswordRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  const {model, idField, passwordField} = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const apiIdentifier = `auth.${model}.all.changePassword`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(model);

  app.post(
    '/auth/change-password',
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true, ['auth']),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {existingPassword, newPassword} = request.body as Record<
        string,
        string
      >;

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

        const user = res.rows[0] as Record<string, unknown>;
        const currentHashedPassword = user[passwordField] as string;

        const isMatch = await compare(
          String(existingPassword),
          currentHashedPassword,
        );
        if (!isMatch) {
          throw Object.assign(new Error('Invalid existing password'), {
            statusCode: 401,
            body: app.buildResponse(401, 'Invalid existing password', null),
          });
        }

        const newHashedPassword = await hash(String(newPassword));

        const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1 WHERE "${idField}" = $2;`;
        await tx.query(updateQuery, [newHashedPassword, userId]);

        await tx.commit();

        return reply.status(200).send(
          app.buildResponse(200, 'Password changed successfully', {
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
  const bodySchema = {
    type: 'object',
    required: ['existingPassword', 'newPassword'],
    properties: {
      existingPassword: {
        type: 'string',
        description: 'The current user password',
      },
      newPassword: {
        type: 'string',
        description: 'The new user password to set',
      },
    },
    additionalProperties: false,
  };

  const responseSchema = getResponseStructureSchema([200], {
    type: 'object',
    properties: {
      success: {type: 'boolean'},
    },
  });

  const schema: Record<string, unknown> = {
    summary: `Change password for ${capitalizeFirstLetter(model)}`,
    description: `Changes the password for an authenticated user in the "${model}" table.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Password'],
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
