import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {
  buildSqlEndpoint,
  handleSql,
} from '@/routes/custom-endpoints/handlers/sql';

import {CustomEndpointConfig, ResolvedAppConfig} from '@/interfaces/config';

export function registerCustomEndpointRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {customEndpoints} = config;

  for (const [name, endpoint] of Object.entries(customEndpoints)) {
    const targets = getApiRouteTargets(
      config,
      'custom',
      'all',
      'unknown',
      name,
    );

    for (const {identifier, variant, policy} of targets) {
      registerCustomEndpoint(
        app,
        config,
        name,
        endpoint,
        variant,
        identifier,
        policy,
      );
    }
  }
}

function registerCustomEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  name: string,
  endpoint: CustomEndpointConfig,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const {schema, routePathSuffix} = generateSchema(config, endpoint, policy);
  const routePath = `/${variant}/custom-endpoints${endpoint.path.replace(/\/$/, '')}${routePathSuffix}`;

  app.route({
    method: endpoint.method,
    url: routePath,
    schema,
    config: {apiIdentifier},
    preValidation: buildPreValidation(
      app,
      config,
      policy.authorization,
      policy.roles,
    ),
    preHandler: async request => {
      await app.callWebhook('request', request, null);
    },
    onSend: async (request, _, payload) => {
      await app.callWebhook('response', request, payload);
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      if (endpoint.handler.type === 'sql') {
        return handleSql(app, request, reply, endpoint.handler.sql);
      }
      return reply
        .status(500)
        .send(
          app.buildResponse(
            500,
            `Handler type "${endpoint.handler.type}" not supported`,
            null,
          ),
        );
    },
  });
}

function generateSchema(
  config: ResolvedAppConfig,
  endpoint: CustomEndpointConfig,
  policy: ResolvedApiPolicy,
): {
  schema: Record<string, unknown>;
  routePathSuffix: string;
} {
  const schema: Record<string, unknown> = {
    summary: `Custom Endpoint: ${endpoint.path}`,
    description: endpoint.description,
    tags: policy.tags,
  };

  let routePathSuffix = '';

  if (endpoint.handler.type === 'sql') {
    const {params, querystring, body, routePath} = buildSqlEndpoint(
      endpoint.handler.sql,
      endpoint.method,
      endpoint.validation,
    );
    if (params) schema.params = params;
    if (querystring) schema.querystring = querystring;
    if (body) schema.body = body;
    routePathSuffix = routePath;
  }

  schema.response = getResponseStructureSchema([200], {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {type: 'object', additionalProperties: true},
      },
      res: {type: 'object', additionalProperties: true},
    },
  });

  const security = buildSecurityArray(config, policy.authorization);

  if (security.length > 0) {
    schema.security = security;
  }

  return {schema, routePathSuffix};
}
