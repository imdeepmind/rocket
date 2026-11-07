import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {
  generateJSONValidationSchema,
  stripAdditionalPostFields,
} from '@/lib/schema/body';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {
  ModelBody,
  ModelConfig,
  ResolvedAppConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerRegistrationRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  const {authentication} = config;
  if (!authentication.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const upConfig = authentication.provider.config as UpAuthProviderConfig;
  const {model, passwordField} = upConfig.userModel;
  const requiresOtp = !!upConfig.userModel.isVerifiedField;
  const isVerifiedField = upConfig.userModel.isVerifiedField;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    'registration',
  );

  for (const {identifier, variant, policy} of targets) {
    registerRegistrationEndpoint(
      app,
      config,
      model,
      authModelConfig,
      passwordField,
      isVerifiedField,
      requiresOtp,
      upConfig,
      variant,
      identifier,
      policy,
    );
  }
}

function registerRegistrationEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  authModelConfig: ModelConfig,
  passwordField: string,
  isVerifiedField: string | undefined,
  requiresOtp: boolean,
  upConfig: UpAuthProviderConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    passwordField,
    model,
    requiresOtp,
    isVerifiedField,
    policy,
  );

  const path = `/${variant}/auth/register`;

  app.post(
    path,
    {
      schema,
      config: {apiIdentifier},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      let tx;
      try {
        tx = await app.db.beginTransaction();

        const incomingBody = request.body;

        const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
          ignorePrimaryKey: true,
        });

        /* c8 ignore start */
        if (body[passwordField] !== undefined && body[passwordField] !== null) {
          const rawPassword = String(body[passwordField]);
          body[passwordField] = await hash(rawPassword);
        }
        /* c8 ignore stop */

        if (isVerifiedField) {
          body[isVerifiedField] = false;
        }

        const keys = Object.keys(body);
        const values = Object.values(body);
        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO "${model}" (${columns}) VALUES (${placeholders});`;

        await tx.query(query, values);

        if (requiresOtp) {
          const usernameField = upConfig.userModel.usernameField;
          const userEmail = String(incomingBody[usernameField]);
          const ulid = await app.otp.sendOTPForVerification(userEmail);

          await tx.commit();

          return reply
            .status(201)
            .send(
              app.buildResponse(
                201,
                'Registration successful. OTP sent to your email.',
                {requiresMfa: true, ulid},
              ),
            );
        }

        const responseData: ModelBody = {};
        for (const [k, v] of Object.entries(body)) {
          if (k !== passwordField) {
            responseData[k] = v;
          }
        }

        await tx.commit();

        return reply
          .status(201)
          .send(
            app.buildResponse(
              201,
              `Successfully registered a new user in the ${model} table`,
              responseData,
            ),
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

function generateSchema(
  authModelConfig: ModelConfig,
  passwordField: string,
  model: string,
  requiresOtp: boolean | undefined,
  isVerifiedField: string | undefined,
  policy: ResolvedApiPolicy,
) {
  const bodyModelConfig =
    requiresOtp && isVerifiedField
      ? {
          ...authModelConfig,
          fields: Object.fromEntries(
            Object.entries(authModelConfig.fields).filter(
              ([name]) => name !== isVerifiedField,
            ),
          ),
        }
      : authModelConfig;
  const bodySchema = generateJSONValidationSchema(bodyModelConfig, {
    ignorePrimaryKey: true,
    additionalProperties: false,
    excludeTimestamps: true,
  });

  const responseData = requiresOtp
    ? {
        type: 'object',
        properties: {requiresMfa: {type: 'boolean'}, ulid: {type: 'string'}},
      }
    : generateJSONValidationSchema(
        {
          ...authModelConfig,
          fields: Object.fromEntries(
            Object.entries(authModelConfig.fields).filter(
              ([name]) => name !== passwordField,
            ),
          ),
        },
        {
          ignorePrimaryKey: true,
          additionalProperties: false,
          excludeTimestamps: true,
        },
      );

  const responseSchema = getResponseStructureSchema([201], responseData);

  const schema: Record<string, unknown> = {
    summary: `Register a new ${capitalizeFirstLetter(model)} user`,
    description: `Creates a new user record in the "${model}" table. The password is hashed with bcrypt before being persisted.`,
    tags: policy.tags,
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
