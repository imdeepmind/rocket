import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {revokeSession} from '@/lib/auth/session';
import {getActiveUserModel} from '@/lib/auth/up-auth';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {ResolvedAppConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerLogoutRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const userModel = getActiveUserModel(config);

  if (!userModel) {
    return;
  }

  const {modelName: model} = userModel;

  if (!config.data.models[model]) {
    return;
  }

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    'logout',
  );

  for (const {identifier, variant, policy} of targets) {
    registerLogoutEndpoint(app, config, model, variant, identifier, policy);
  }
}

function registerLogoutEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema = generateSchema(model, policy);
  const path = `/${variant}/auth/logout`;

  app.post(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as Record<string, unknown> | undefined)?.id;

      if (!userId) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'User ID missing in token payload', null),
          );
      }

      const {refreshToken} = request.body as {refreshToken: string};

      await revokeSession(app, config, refreshToken, userId);

      return reply.status(200).send(
        app.buildResponse(200, 'Logged out successfully', {
          success: true,
        }),
      );
    },
  );
}

function generateSchema(model: string, policy: ResolvedApiPolicy) {
  return {
    summary: `Logout for ${capitalizeFirstLetter(model)}`,
    description:
      'Revokes the provided refresh token session for the authenticated user.',
    tags: policy.tags,
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: {
          type: 'string',
          minLength: 1,
          description: 'Refresh token to revoke',
        },
      },
      additionalProperties: false,
    },
    response: getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
      },
    }),
    security: [{bearerAuth: []}],
  };
}
