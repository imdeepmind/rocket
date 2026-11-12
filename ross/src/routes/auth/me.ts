import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {generateJSONValidationSchema} from '@/lib/schema/body';
import {getResponseStructureSchema} from '@/lib/schema/response';
import {getPublicFields} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {ResolvedAppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerMeRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  const {authentication} = config;
  if (!authentication.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const {model, idField} = (
    authentication.provider.config as UpAuthProviderConfig
  ).userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'me');

  for (const {identifier, variant, policy} of targets) {
    registerMeEndpoint(
      app,
      config,
      model,
      idField,
      variant,
      identifier,
      policy,
    );
  }
}

function registerMeEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  idField: string,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(model, config, policy);

  const path = `/${variant}/auth/user/me`;

  app.get(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true),
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

      const authModelConfig = config.data.models[model];
      const publicFields = getPublicFields(
        authModelConfig,
        policy.bypassSecret,
      );
      const columns = [
        ...new Set([idField, ...publicFields.map(([name]) => name)]),
      ]
        .map(name => `"${name}"`)
        .join(', ');

      const query = `SELECT ${columns} FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
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

function generateSchema(
  model: string,
  config: ResolvedAppConfig,
  policy: ResolvedApiPolicy,
) {
  const authModelConfig = config.data.models[model];

  const dataSchema = authModelConfig
    ? generateJSONValidationSchema(authModelConfig, {
        excludeSecretFields: !policy.bypassSecret,
      })
    : {type: 'object', additionalProperties: true};

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Get authenticated user profile for ${capitalizeFirstLetter(model)}`,
    description: `Returns the profile of the currently authenticated user from the "${model}" table.`,
    tags: policy.tags,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
