import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {buildProviderDescriptors} from '@/lib/auth/discovery';
import {getAuthModel} from '@/lib/auth/up-auth';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {ResolvedAppConfig} from '@/interfaces/config';

export function registerProvidersRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const authModel = getAuthModel(config);

  if (!authModel) {
    return;
  }

  const targets = getApiRouteTargets(
    config,
    'auth',
    authModel,
    'unknown',
    'providers',
  );

  for (const {identifier, variant, policy} of targets) {
    registerProvidersEndpoint(app, config, variant, identifier, policy);
  }
}

function registerProvidersEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  app.get(
    `/${variant}/auth/providers`,
    {
      schema: generateSchema(policy),
      config: {apiIdentifier},
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const [basePath] = request.url.split('/auth/providers');

      return reply
        .status(200)
        .send(
          app.buildResponse(
            200,
            'Authentication providers',
            buildProviderDescriptors(config, basePath),
          ),
        );
    },
  );
}

function generateSchema(policy: ResolvedApiPolicy) {
  const responseSchema = getResponseStructureSchema([200], {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: {type: 'string'},
        name: {type: 'string'},
        protocol: {type: 'string'},
        capabilities: {type: 'array', items: {type: 'string'}},
        login: {
          type: 'object',
          properties: {
            method: {type: 'string'},
            url: {type: 'string'},
          },
        },
      },
    },
  });

  return {
    summary: 'List configured authentication providers',
    description:
      'Returns every active authentication provider with the endpoints the frontend needs to render login options.',
    tags: policy.tags,
    response: responseSchema,
  };
}
