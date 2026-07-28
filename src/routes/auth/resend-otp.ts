import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

function registerResendOtpBase(
  app: FastifyInstance,
  config: AppConfig,
  path: string,
  action: 'login' | 'register' | 'forgot-password',
): void {
  const {models} = config.data;

  const upConfig = config.authentication!.provider
    .config as UpAuthProviderConfig;
  const {model, usernameField} = upConfig.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const apiIdentifier = `auth.${model}.all.resend-otp-${action}`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(
    usernameField,
    model,
    action,
  );

  app.post(
    path,
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
        app.buildResponse(200, 'OTP resent to your email.', {
          requiresMfa: true,
          ulid,
        }),
      );
    },
  );
}

export function registerLoginResendOtpRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerResendOtpBase(app, config, '/auth/login/resend/otp', 'login');
}

export function registerRegistrationResendOtpRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerResendOtpBase(app, config, '/auth/register/resend/otp', 'register');
}

export function registerForgotPasswordResendOtpRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerResendOtpBase(
    app,
    config,
    '/auth/forgot-password/resend/otp',
    'forgot-password',
  );
}

function generateSchema(usernameField: string, model: string, action: string) {
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
    summary: `Resend OTP for ${capitalizeFirstLetter(model)} ${action}`,
    description: `Resends an OTP to the user's email for ${action}.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'OTP'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
