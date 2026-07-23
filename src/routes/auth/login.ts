import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, UpAuthProviderConfig} from '@/interfaces/config';

import {compare} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerLoginRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, authentication} = config;

  if (!authentication?.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const {model, usernameField, passwordField} =
    authentication.provider.config.userModel;

  const authModelConfig = models.find(m => m.name === model);

  if (!authModelConfig) {
    app.log.warn(
      `[auth/login] Could not find model config for "${model}". Skipping route registration.`,
    );
    return;
  }

  const upConfig = authentication.provider.config as UpAuthProviderConfig;

  const schema: Record<string, unknown> = generateSchema(
    usernameField,
    passwordField,
    model,
    upConfig.mfaRequired ?? false,
  );

  app.post(
    '/auth/login',
    {
      schema,
      config: {apiIdentifier: `authAPIs->${model}->all->login`},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {[usernameField]: username, [passwordField]: password} =
        request.body;

      const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [username]);

      if (res.rows.length === 0) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid username or password', null));
      }

      const user = res.rows[0] as Record<string, unknown>;
      const hashedPassword = user[passwordField] as string;

      const isMatch = await compare(String(password), hashedPassword);

      if (!isMatch) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid username or password', null));
      }

      if (upConfig.mfaRequired) {
        const userEmail = String(user[usernameField]);
        const ulid = await app.otp.sendOTPForVerification(userEmail);

        return reply.status(200).send(
          app.buildResponse(200, 'Login successful. OTP sent to your email.', {
            requiresMfa: true,
            ulid,
          }),
        );
      }

      const payload = {
        id: user[upConfig.userModel.idField],
        [usernameField]: user[usernameField],
      };

      const token = app.jwt.sign(payload, {
        expiresIn: upConfig.tokenExpiration || '1d',
      });

      return reply.status(200).send(
        app.buildResponse(200, 'Login successful', {
          accessToken: token,
        }),
      );
    },
  );
}

function generateSchema(
  usernameField: string,
  passwordField: string,
  model: string,
  mfaRequired: boolean,
) {
  const bodySchema = {
    type: 'object',
    required: [usernameField, passwordField],
    properties: {
      [usernameField]: {type: 'string', description: 'The user identifier'},
      [passwordField]: {type: 'string', description: 'The user password'},
    },
    additionalProperties: false,
  };

  const dataSchema: Record<string, unknown> = {
    type: 'object',
    properties: mfaRequired
      ? {
          requiresMfa: {
            type: 'boolean',
            description: 'Indicates MFA is required',
          },
          ulid: {type: 'string', description: 'OTP verification ULID'},
        }
      : {
          accessToken: {type: 'string', description: 'JWT access token'},
        },
  };

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Login for ${capitalizeFirstLetter(model)}`,
    description: `Authenticates a user from the "${model}" table and returns a JWT access token.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Login'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
