import bcrypt from 'bcrypt';
import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerChangePasswordRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  const {modelName, idColumn, passwordColumn} = auth.authModel;

  const authModelConfig = models.find(m => m.name === modelName);
  if (!authModelConfig) {
    app.log.warn(
      `[auth/change-password] Could not find model config for "${modelName}". Skipping route registration.`,
    );
    return;
  }

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
    summary: `Change password for ${capitalizeFirstLetter(modelName)}`,
    description: `Changes the password for an authenticated user in the "${modelName}" table.`,
    tags: [capitalizeFirstLetter(modelName), 'Auth', 'Password'],
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };

  app.post(
    '/auth/change-password',
    {
      schema,
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
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

      // Extract user info from JWT payload
      const userPayload = request.user as Record<string, unknown>;
      const userId = userPayload.id;

      if (!userId) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'User ID missing in token payload', null),
          );
      }

      // Find user by ID
      const query = `SELECT * FROM "${modelName}" WHERE "${idColumn}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [userId]);

      if (res.rows.length === 0) {
        return reply
          .status(404)
          .send(app.buildResponse(404, 'User not found', null));
      }

      const user = res.rows[0] as Record<string, unknown>;
      const currentHashedPassword = user[passwordColumn] as string;

      // Verify existing password
      const isMatch = await bcrypt.compare(
        String(existingPassword),
        currentHashedPassword,
      );
      if (!isMatch) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid existing password', null));
      }

      // Hash the new password
      const newHashedPassword = await bcrypt.hash(String(newPassword), 10);

      // Update the password
      const updateQuery = `UPDATE "${modelName}" SET "${passwordColumn}" = $1 WHERE "${idColumn}" = $2;`;
      await app.db.query(updateQuery, [newHashedPassword, userId]);

      return reply.status(200).send(
        app.buildResponse(200, 'Password changed successfully', {
          success: true,
        }),
      );
    },
  );
}
