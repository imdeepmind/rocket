import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  generateJSONValidationSchema,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerMeRoute(app: FastifyInstance, config: AppConfig): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const {model, idField} = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const defaultApiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.me`;

  if (config.apis?.[defaultApiIdentifier]?.enabled === false) return;

  registerMeEndpoint(
    app,
    config,
    model,
    idField,
    defaultVariant,
    defaultApiIdentifier,
  );

  const baseIdentifier = buildApiIdentifier(
    'auth',
    defaultVariant,
    model,
    'unknown',
    'me',
  );
  const additionalVariants = getAdditionalVariants(config, baseIdentifier);

  for (const variant of additionalVariants) {
    const variantApiIdentifier = buildApiIdentifier(
      'auth',
      variant,
      model,
      'unknown',
      'me',
    );

    if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

    registerMeEndpoint(
      app,
      config,
      model,
      idField,
      variant,
      variantApiIdentifier,
    );
  }
}

function registerMeEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  model: string,
  idField: string,
  variant: string,
  apiIdentifier: string,
): void {
  const schema: Record<string, unknown> = generateSchema(model, config);

  const path = `/${variant}/auth/user/me`;

  app.get(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true, ['auth']),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userPayload = request.user as Record<string, unknown>;
      const userId = userPayload.id;

      if (!userId) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'User ID missing in token payload', null),
          );
      }

      const query = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [userId]);

      if (res.rows.length === 0) {
        return reply
          .status(404)
          .send(app.buildResponse(404, 'User not found', null));
      }

      const user = res.rows[0];

      return reply
        .status(200)
        .send(
          app.buildResponse(200, 'User profile retrieved successfully', user),
        );
    },
  );
}

function generateSchema(model: string, config: AppConfig) {
  const authModelConfig = config.data.models[model];

  const dataSchema = authModelConfig
    ? generateJSONValidationSchema(authModelConfig)
    : {type: 'object', additionalProperties: true};

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Get authenticated user profile for ${capitalizeFirstLetter(model)}`,
    description: `Returns the profile of the currently authenticated user from the "${model}" table.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Profile'],
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
