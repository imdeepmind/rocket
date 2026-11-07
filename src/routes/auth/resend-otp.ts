import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {ResolvedAppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

function registerResendOtpBase(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  path: string,
  action: 'login' | 'register' | 'forgotPassword',
): void {
  const {models} = config.data;

  const {authentication} = config;
  if (!authentication.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const upConfig = authentication.provider.config as UpAuthProviderConfig;
  const {model, usernameField} = upConfig.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const operation = `resendOtp${capitalizeFirstLetter(action)}`;

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    operation,
  );

  for (const {identifier, variant, policy} of targets) {
    registerResendOtpEndpoint(
      app,
      config,
      model,
      usernameField,
      action,
      path,
      variant,
      identifier,
      policy,
    );
  }
}

function registerResendOtpEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  usernameField: string,
  action: string,
  path: string,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    usernameField,
    model,
    action,
    policy,
  );

  const routePath = `/${variant}${path}`;

  app.post(
    routePath,
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
  config: ResolvedAppConfig,
): void {
  registerResendOtpBase(app, config, '/auth/login/resend/otp', 'login');
}

export function registerRegistrationResendOtpRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  registerResendOtpBase(app, config, '/auth/register/resend/otp', 'register');
}

export function registerForgotPasswordResendOtpRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  registerResendOtpBase(
    app,
    config,
    '/auth/forgot-password/resend/otp',
    'forgotPassword',
  );
}

function generateSchema(
  usernameField: string,
  model: string,
  action: string,
  policy: ResolvedApiPolicy,
) {
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
    tags: policy.tags,
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
