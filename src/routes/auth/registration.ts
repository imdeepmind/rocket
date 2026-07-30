import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {
  AppConfig,
  ModelBody,
  ModelConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerRegistrationRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const upConfig = config.authentication!.provider
    .config as UpAuthProviderConfig;
  const {model, passwordField} = upConfig.userModel;
  const requiresOtp = !!upConfig.userModel.isVerifiedField;
  const isVerifiedField = upConfig.userModel.isVerifiedField;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const defaultApiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.registration`;

  if (config.apis?.[defaultApiIdentifier]?.enabled === false) return;

  const defaultTags = config.apis?.[defaultApiIdentifier]?.tags;

  registerRegistrationEndpoint(
    app,
    config,
    model,
    authModelConfig,
    passwordField,
    isVerifiedField,
    requiresOtp,
    upConfig,
    defaultVariant,
    defaultApiIdentifier,
    defaultTags,
  );

  const baseIdentifier = buildApiIdentifier(
    'auth',
    defaultVariant,
    model,
    'unknown',
    'registration',
  );
  const additionalVariants = getAdditionalVariants(config, baseIdentifier);

  for (const variant of additionalVariants) {
    const variantApiIdentifier = buildApiIdentifier(
      'auth',
      variant,
      model,
      'unknown',
      'registration',
    );

    if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

    const variantTags = config.apis?.[variantApiIdentifier]?.tags;

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
      variantApiIdentifier,
      variantTags,
    );
  }
}

function registerRegistrationEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  model: string,
  authModelConfig: ModelConfig,
  passwordField: string,
  isVerifiedField: string | undefined,
  requiresOtp: boolean,
  upConfig: UpAuthProviderConfig,
  variant: string,
  apiIdentifier: string,
  routeTags?: string[],
): void {
  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    passwordField,
    model,
    requiresOtp,
    isVerifiedField,
    routeTags,
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

        const res = await tx.query(query, values);

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
                res,
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
              res,
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
  requiresOtp?: boolean,
  isVerifiedField?: string,
  routeTags?: string[],
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
        {ignorePrimaryKey: true, additionalProperties: false},
      );

  const responseSchema = getResponseStructureSchema(
    [201],
    responseData,
    responseData,
  );

  const schema: Record<string, unknown> = {
    summary: `Register a new ${capitalizeFirstLetter(model)} user`,
    description: `Creates a new user record in the "${model}" table. The password is hashed with bcrypt before being persisted.`,
    tags: routeTags ?? [capitalizeFirstLetter(model), 'Auth', 'Register'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
