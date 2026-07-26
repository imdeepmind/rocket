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

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerRegistrationRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {authentication} = config;
  const {models} = config.data;

  if (!authentication?.enabled || authentication.provider.type !== 'up-auth')
    return;

  const {model, passwordField} = authentication.provider.config.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const upConfig = authentication.provider.config as UpAuthProviderConfig;
  const requiresOtp = !!upConfig.userModel.isVerifiedField;
  const isVerifiedField = upConfig.userModel.isVerifiedField;

  const apiIdentifier = `auth.${model}.all.registration`;

  if (config.apis?.[apiIdentifier]?.enabled === false) return;

  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    passwordField,
    model,
    requiresOtp,
    isVerifiedField,
  );

  app.post(
    '/auth/register',
    {
      schema,
      config: {apiIdentifier},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const incomingBody = request.body;

      const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
        ignorePrimaryKey: true,
      });

      if (body[passwordField] !== undefined && body[passwordField] !== null) {
        const rawPassword = String(body[passwordField]);
        body[passwordField] = await hash(rawPassword);
      }

      if (isVerifiedField) {
        body[isVerifiedField] = false;
      }

      const keys = Object.keys(body);
      const values = Object.values(body);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${model}" (${columns}) VALUES (${placeholders});`;

      const res = await app.db.query(query, values);

      if (requiresOtp) {
        const usernameField = upConfig.userModel.usernameField;
        const userEmail = String(incomingBody[usernameField]);
        const ulid = await app.otp.sendOTPForVerification(userEmail);

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
    },
  );
}

function generateSchema(
  authModelConfig: ModelConfig,
  passwordField: string,
  model: string,
  requiresOtp: boolean = false,
  isVerifiedField?: string,
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
    tags: [capitalizeFirstLetter(model), 'Auth', 'Register'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
