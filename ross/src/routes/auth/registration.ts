import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getUpAuth, UpAuthRuntime} from '@/lib/auth/up-auth';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {
  generateJSONValidationSchema,
  stripAdditionalPostFields,
} from '@/lib/schema/body';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {ModelBody, ModelConfig, ResolvedAppConfig} from '@/interfaces/config';

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerRegistrationRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  const upAuth = getUpAuth(config);

  if (!upAuth) {
    return;
  }

  const {model, passwordField, isVerifiedField} = upAuth;

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
      model,
      authModelConfig,
      passwordField,
      isVerifiedField,
      upAuth,
      variant,
      identifier,
      policy,
    );
  }
}

function registerRegistrationEndpoint(
  app: FastifyInstance,
  model: string,
  authModelConfig: ModelConfig,
  passwordField: string,
  isVerifiedField: string,
  upAuth: UpAuthRuntime,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    model,
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
      const incomingBody = request.body;

      const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
        ignorePrimaryKey: true,
      });

      // Every identity row records which provider owns it. Without this the
      // password guardrails cannot distinguish SSO accounts.
      if (body[upAuth.providerField] === undefined) {
        body[upAuth.providerField] = 'up-auth';
      }

      /* c8 ignore start */
      if (body[passwordField] !== undefined && body[passwordField] !== null) {
        const rawPassword = String(body[passwordField]);
        body[passwordField] = await hash(rawPassword);
      }
      /* c8 ignore stop */

      body[isVerifiedField] = false;

      const keys = Object.keys(body);
      const values = Object.values(body);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${model}" (${columns}) VALUES (${placeholders});`;

      let tx;
      try {
        tx = await app.db.beginTransaction();
        await tx.query(query, values);
        await tx.commit();
      } catch (err) {
        if (tx) await tx.rollback().catch(() => {});
        throw err;
      } finally {
        tx?.release();
      }

      const emailField = upAuth.emailField;
      const userEmail = String(incomingBody[emailField]);
      const ulid = await app.otp.sendOTPForVerification(userEmail);

      return reply
        .status(201)
        .send(
          app.buildResponse(
            201,
            'Registration successful. OTP sent to your email.',
            {requiresMfa: true, ulid},
          ),
        );
    },
  );
}

function generateSchema(
  authModelConfig: ModelConfig,
  model: string,
  isVerifiedField: string,
  policy: ResolvedApiPolicy,
) {
  const bodyModelConfig = {
    ...authModelConfig,
    fields: Object.fromEntries(
      Object.entries(authModelConfig.fields).filter(
        ([name]) => name !== isVerifiedField,
      ),
    ),
  };
  const bodySchema = generateJSONValidationSchema(bodyModelConfig, {
    ignorePrimaryKey: true,
    additionalProperties: false,
    excludeTimestamps: true,
  });

  const responseData = {
    type: 'object',
    properties: {requiresMfa: {type: 'boolean'}, ulid: {type: 'string'}},
  };

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
