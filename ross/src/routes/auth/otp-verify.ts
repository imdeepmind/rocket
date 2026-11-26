import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {createSession} from '@/lib/auth/session';
import {issueAccessToken} from '@/lib/auth/token';
import {getUpAuth, UpAuthRuntime} from '@/lib/auth/up-auth';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';
import {buildUpdatedAtClause} from '@/lib/sql/timestamps';

import {ModelBody, ResolvedAppConfig} from '@/interfaces/config';

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

function registerOtpVerifyBase(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  path: string,
  action: 'login' | 'register' | 'forgotPassword',
): void {
  const {models} = config.data;

  const upAuth = getUpAuth(config);

  if (!upAuth) {
    return;
  }

  const {model, emailField} = upAuth;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const operation = `otpVerify${capitalizeFirstLetter(action)}`;

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    operation,
  );

  for (const {identifier, variant, policy} of targets) {
    registerOtpVerifyEndpoint(
      app,
      config,
      model,
      emailField,
      upAuth,
      action,
      path,
      variant,
      identifier,
      policy,
    );
  }
}

function registerOtpVerifyEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  emailField: string,
  upAuth: UpAuthRuntime,
  action: 'login' | 'register' | 'forgotPassword',
  path: string,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    emailField,
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
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {ulid, otp, [emailField]: email} = request.body;

      /* c8 ignore start */
      if (!ulid || !otp || !email) {
        return reply
          .status(400)
          .send(
            app.buildResponse(400, 'ulid, otp, and email are required', null),
          );
      }
      /* c8 ignore stop */

      const isValid = await app.otp.verify(
        String(email),
        String(otp),
        String(ulid),
      );

      if (!isValid) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid or expired OTP', null));
      }

      let hashedPassword: string | undefined;
      if (action === 'forgotPassword') {
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
        hashedPassword = await hash(String(newPassword));
      }

      const selectQuery = `SELECT * FROM "${model}" WHERE "${emailField}" = $1 LIMIT 1;`;

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const res = await tx.query(selectQuery, [String(email)]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 401,
            body: app.buildResponse(401, 'User not found', null),
          });
        }

        if (action === 'register') {
          const isVerifiedField = upAuth.isVerifiedField;
          const updatedAtClause = buildUpdatedAtClause(
            config.data.models[model],
            config.infrastructure.database.engine,
          );
          const updateQuery = `UPDATE "${model}" SET "${isVerifiedField}" = true${updatedAtClause ? `, ${updatedAtClause}` : ''} WHERE "${emailField}" = $1;`;
          await tx.query(updateQuery, [String(email)]);

          await tx.commit();

          return reply
            .status(200)
            .send(app.buildResponse(200, 'OTP verification successful', null));
        }

        if (action === 'forgotPassword') {
          const {passwordField} = upAuth;
          const updatedAtClause = buildUpdatedAtClause(
            config.data.models[model],
            config.infrastructure.database.engine,
          );
          const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1${updatedAtClause ? `, ${updatedAtClause}` : ''} WHERE "${emailField}" = $2;`;
          await tx.query(updateQuery, [hashedPassword, String(email)]);

          await tx.commit();

          return reply.status(200).send(
            app.buildResponse(200, 'OTP verification successful', {
              success: true,
            }),
          );
        }

        const user = res.rows[0] as Record<string, unknown>;

        let rbacUser = user;
        if (
          config.rbac?.enabled &&
          config.rbac.modelName &&
          config.rbac.modelName !== model
        ) {
          const rbacQuery = `SELECT * FROM "${config.rbac.modelName}" WHERE "${upAuth.idField}" = $1 LIMIT 1;`;
          const rbacRes = await tx.query(rbacQuery, [user[upAuth.idField]]);
          rbacUser = (rbacRes.rows[0] as Record<string, unknown>) ?? user;
        }

        const token = issueAccessToken(
          app.jwt,
          config,
          user,
          emailField,
          rbacUser,
        );

        await tx.commit();

        const {refreshToken} = await createSession(
          app,
          config,
          user[upAuth.idField],
        );

        return reply.status(200).send(
          app.buildResponse(200, 'OTP verification successful', {
            accessToken: token,
            refreshToken,
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
  config: ResolvedAppConfig,
): void {
  registerOtpVerifyBase(app, config, '/auth/login/verify/otp', 'login');
}

export function registerRegistrationOtpVerifyRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  registerOtpVerifyBase(app, config, '/auth/register/verify/otp', 'register');
}

function generateSchema(
  emailField: string,
  model: string,
  action: 'login' | 'register' | 'forgotPassword',
  policy: ResolvedApiPolicy,
) {
  const isForgotPassword = action === 'forgotPassword';

  const bodySchema = {
    type: 'object',
    required: isForgotPassword
      ? ['ulid', 'otp', emailField, 'newPassword']
      : ['ulid', 'otp', emailField],
    properties: {
      ulid: {
        type: 'string',
        description: 'The ULID from the OTP send response',
      },
      otp: {type: 'string', description: 'The OTP sent to the user email'},
      [emailField]: {type: 'string', description: 'The user identifier'},
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
            refreshToken: {type: 'string', description: 'Refresh token'},
          },
        }
      : action === 'forgotPassword'
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
    tags: policy.tags,
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}

export function registerForgotPasswordOtpVerifyRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  registerOtpVerifyBase(
    app,
    config,
    '/auth/forgot-password/verify/otp',
    'forgotPassword',
  );
}
