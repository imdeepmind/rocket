import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerForgotPasswordRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  const {model, usernameField} = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const apiIdentifier = `auth.${model}.all.forgotPassword`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(usernameField, model);

  app.post(
    '/auth/forgot-password',
    {
      schema,
      config: {apiIdentifier},
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {[usernameField]: username} = request.body as Record<
        string,
        string
      >;

      /* c8 ignore start */
      if (!username) {
        return reply
          .status(400)
          .send(app.buildResponse(400, `${usernameField} is required`, null));
      }
      /* c8 ignore stop */

      const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [String(username)]);

      if (res.rows.length === 0) {
        return reply
          .status(404)
          .send(app.buildResponse(404, 'User not found', null));
      }

      const user = res.rows[0] as Record<string, unknown>;
      const userEmail = String(user[usernameField]);
      const ulid = await app.otp.sendOTPForVerification(userEmail);

      return reply.status(200).send(
        app.buildResponse(200, 'OTP sent to your email.', {
          requiresMfa: true,
          ulid,
        }),
      );
    },
  );
}

function generateSchema(usernameField: string, model: string) {
  const bodySchema = {
    type: 'object',
    required: [usernameField],
    properties: {
      [usernameField]: {type: 'string', description: 'The user identifier'},
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
    summary: `Forgot password for ${capitalizeFirstLetter(model)}`,
    description: "Sends an OTP to the user's email for password reset.",
    tags: [capitalizeFirstLetter(model), 'Auth', 'Password'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
