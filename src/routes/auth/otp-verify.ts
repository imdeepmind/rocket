import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

function registerOtpVerifyBase(
  app: FastifyInstance,
  config: AppConfig,
  path: string,
  action: 'login' | 'registration',
): void {
  const {authentication} = config;
  const {models} = config.data;

  if (!authentication?.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const {model, usernameField} = authentication.provider.config.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) {
    app.log.warn(
      `[auth/otp-verify] Could not find model config for "${model}". Skipping route registration.`,
    );
    return;
  }

  const upConfig = authentication.provider.config as UpAuthProviderConfig;

  const apiIdentifier = `authAPIs.${model}.all.otp-verify-${action}`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(
    usernameField,
    model,
    action,
  );

  const isRegistration = action === 'registration';

  app.post(
    path,
    {
      schema,
      config: {apiIdentifier},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {ulid, otp, [usernameField]: username} = request.body;

      if (!ulid || !otp || !username) {
        return reply
          .status(400)
          .send(
            app.buildResponse(
              400,
              'ulid, otp, and username are required',
              null,
            ),
          );
      }

      const isValid = await app.otp.verify(
        String(username),
        String(otp),
        String(ulid),
      );

      if (!isValid) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid or expired OTP', null));
      }

      const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [String(username)]);

      if (res.rows.length === 0) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'User not found', null));
      }

      if (isRegistration) {
        const isVerifiedField = upConfig.userModel.isVerifiedField;
        if (isVerifiedField) {
          const updateQuery = `UPDATE "${model}" SET "${isVerifiedField}" = true WHERE "${usernameField}" = $1;`;
          await app.db.query(updateQuery, [String(username)]);
        }

        return reply
          .status(200)
          .send(app.buildResponse(200, 'OTP verification successful', null));
      }

      const user = res.rows[0] as Record<string, unknown>;

      const payload = {
        id: user[upConfig.userModel.idField],
        [usernameField]: user[usernameField],
      };

      const token = app.jwt.sign(payload, {
        expiresIn: upConfig.tokenExpiration || '1d',
      });

      return reply.status(200).send(
        app.buildResponse(200, 'OTP verification successful', {
          accessToken: token,
        }),
      );
    },
  );
}

export function registerLoginOtpVerifyRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerOtpVerifyBase(app, config, '/auth/login/verify/otp', 'login');
}

export function registerRegistrationOtpVerifyRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerOtpVerifyBase(
    app,
    config,
    '/auth/registration/verify/otp',
    'registration',
  );
}

function generateSchema(
  usernameField: string,
  model: string,
  action: 'login' | 'registration',
) {
  const bodySchema = {
    type: 'object',
    required: ['ulid', 'otp', usernameField],
    properties: {
      ulid: {
        type: 'string',
        description: 'The ULID from the login/register response',
      },
      otp: {type: 'string', description: 'The OTP sent to the user email'},
      [usernameField]: {type: 'string', description: 'The user identifier'},
    },
    additionalProperties: false,
  };

  const dataSchema =
    action === 'login'
      ? {
          type: 'object',
          properties: {
            accessToken: {type: 'string', description: 'JWT access token'},
          },
        }
      : {
          type: 'object',
          properties: {},
          nullable: true,
        };

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Verify OTP for ${capitalizeFirstLetter(model)} ${action}`,
    description: `Verifies the OTP sent to the user's email during ${action}.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'OTP'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
