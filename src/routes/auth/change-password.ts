import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig} from '@/interfaces/config';

import {compare, hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerChangePasswordRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, authentication} = config;

  if (!authentication?.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const {model, idField, passwordField} =
    authentication.provider.config.userModel;

  const authModelConfig = models.find(m => m.name === model);
  if (!authModelConfig) {
    app.log.warn(
      `[auth/change-password] Could not find model config for "${model}". Skipping route registration.`,
    );
    return;
  }

  const schema: Record<string, unknown> = generateSchema(model);

  app.post(
    '/auth/change-password',
    {
      schema,
      config: {apiIdentifier: `authAPIs->${model}->all->changePassword`},
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.authenticate();
        } catch {
          return reply
            .status(401)
            .send(
              app.buildResponse(
                401,
                'Invalid or expired authentication token',
                null,
              ),
            );
        }
      },
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

      const query = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [userId]);

      if (res.rows.length === 0) {
        return reply
          .status(404)
          .send(app.buildResponse(404, 'User not found', null));
      }

      const user = res.rows[0] as Record<string, unknown>;
      const currentHashedPassword = user[passwordField] as string;

      const isMatch = await compare(
        String(existingPassword),
        currentHashedPassword,
      );
      if (!isMatch) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid existing password', null));
      }

      const newHashedPassword = await hash(String(newPassword));

      const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1 WHERE "${idField}" = $2;`;
      await app.db.query(updateQuery, [newHashedPassword, userId]);

      return reply.status(200).send(
        app.buildResponse(200, 'Password changed successfully', {
          success: true,
        }),
      );
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
