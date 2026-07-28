import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerEmailChangeRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  const upConfig = config.authentication!.provider
    .config as UpAuthProviderConfig;
  const {model, idField, usernameField, isVerifiedField} = upConfig.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const apiIdentifier = `auth.${model}.all.emailChange`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(usernameField, model);

  app.patch(
    '/auth/user/email',
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

      const body = request.body as Record<string, string>;
      const newEmail = body[usernameField];

      /* c8 ignore start */
      if (!newEmail) {
        return reply
          .status(400)
          .send(app.buildResponse(400, `${usernameField} is required`, null));
      }
      /* c8 ignore stop */

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
        const res = await tx.query(selectQuery, [userId]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 404,
            body: app.buildResponse(404, 'User not found', null),
          });
        }

        const setClauses = [`"${usernameField}" = $1`];
        const values: unknown[] = [newEmail];

        if (isVerifiedField) {
          setClauses.push(`"${isVerifiedField}" = $2`);
          values.push(false);
        }

        values.push(userId);
        const paramIndex = setClauses.length + 1;
        const updateQuery = `UPDATE "${model}" SET ${setClauses.join(', ')} WHERE "${idField}" = $${paramIndex};`;
        await tx.query(updateQuery, values);

        await tx.commit();

        const ulid = await app.otp.sendOTPForVerification(newEmail);

        return reply.status(200).send(
          app.buildResponse(200, 'Email updated. OTP sent to your new email.', {
            requiresMfa: true,
            ulid,
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

function generateSchema(usernameField: string, model: string) {
  const bodySchema = {
    type: 'object',
    required: [usernameField],
    properties: {
      [usernameField]: {type: 'string', description: 'The new email address'},
    },
    additionalProperties: false,
  };

  const dataSchema = {
    type: 'object',
    properties: {
      requiresMfa: {
        type: 'boolean',
        description: 'Indicates MFA is required',
      },
      ulid: {type: 'string', description: 'OTP verification ULID'},
    },
  };

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Change email for ${capitalizeFirstLetter(model)}`,
    description: `Updates the email address for the authenticated user in the "${model}" table and sends an OTP to the new email.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Profile'],
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
