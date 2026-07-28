import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, UpAuthProviderConfig} from '@/interfaces/config';

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

function registerOtpVerifyBase(
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

  const apiIdentifier = `auth.${model}.all.otp-verify-${action}`;

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
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {ulid, otp, [usernameField]: username} = request.body;

      /* c8 ignore start */
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
      /* c8 ignore stop */

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

      const selectQuery = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const res = await tx.query(selectQuery, [String(username)]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 401,
            body: app.buildResponse(401, 'User not found', null),
          });
        }

        if (action === 'register') {
          const isVerifiedField = upConfig.userModel.isVerifiedField;
          if (isVerifiedField) {
            const updateQuery = `UPDATE "${model}" SET "${isVerifiedField}" = true WHERE "${usernameField}" = $1;`;
            await tx.query(updateQuery, [String(username)]);
          }

          await tx.commit();

          return reply
            .status(200)
            .send(app.buildResponse(200, 'OTP verification successful', null));
        }

        if (action === 'forgot-password') {
          const newPassword = (request.body as Record<string, string>)
            .newPassword;
          /* c8 ignore start */
          if (!newPassword) {
            throw Object.assign(new Error('newPassword is required'), {
              statusCode: 400,
              body: app.buildResponse(400, 'newPassword is required', null),
            });
          }
          /* c8 ignore stop */

          const {passwordField} = upConfig.userModel;
          const hashedPassword = await hash(String(newPassword));
          const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1 WHERE "${usernameField}" = $2;`;
          await tx.query(updateQuery, [hashedPassword, String(username)]);

          await tx.commit();

          return reply.status(200).send(
            app.buildResponse(200, 'OTP verification successful', {
              success: true,
            }),
          );
        }

        const user = res.rows[0] as Record<string, unknown>;

        const payload = {
          id: user[upConfig.userModel.idField],
          [usernameField]: user[usernameField],
        };

        const token = app.jwt.sign(payload, {
          expiresIn: upConfig.tokenExpiration || '1d',
        });

        await tx.commit();

        return reply.status(200).send(
          app.buildResponse(200, 'OTP verification successful', {
            accessToken: token,
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
  registerOtpVerifyBase(app, config, '/auth/register/verify/otp', 'register');
}

function generateSchema(
  usernameField: string,
  model: string,
  action: 'login' | 'register' | 'forgot-password',
) {
  const isForgotPassword = action === 'forgot-password';

  const bodySchema = {
    type: 'object',
    required: isForgotPassword
      ? ['ulid', 'otp', usernameField, 'newPassword']
      : ['ulid', 'otp', usernameField],
    properties: {
      ulid: {
        type: 'string',
        description: 'The ULID from the OTP send response',
      },
      otp: {type: 'string', description: 'The OTP sent to the user email'},
      [usernameField]: {type: 'string', description: 'The user identifier'},
      ...(isForgotPassword
        ? {
            newPassword: {
              type: 'string',
              description: 'The new password to set',
            },
          }
        : {}),
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
      : action === 'forgot-password'
        ? {
            type: 'object',
            properties: {
              success: {type: 'boolean'},
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

export function registerForgotPasswordOtpVerifyRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  registerOtpVerifyBase(
    app,
    config,
    '/auth/forgot-password/verify/otp',
    'forgot-password',
  );
}
