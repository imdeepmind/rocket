import * as fs from 'fs';

import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {
  buildFunctionEndpointSchema,
  handleFunction,
  resolveFunctionArtifactPath,
} from '@/routes/custom-endpoints/handlers/function';
import {
  buildSqlEndpoint,
  handleSql,
} from '@/routes/custom-endpoints/handlers/sql';

import {CustomEndpointConfig, ResolvedAppConfig} from '@/interfaces/config';

export function registerCustomEndpointRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  options?: {configDir?: string; outDir?: string},
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
        options,
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
  options?: {configDir?: string; outDir?: string},
): void {
  let artifactPath = '';
  if (endpoint.handler.type === 'function') {
    artifactPath = resolveFunctionArtifactPath(
      endpoint.handler.file,
      options?.configDir,
      options?.outDir,
    );
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        `Compiled function artifact missing for endpoint "${name}". Run "ross build" first.`,
      );
    }
  }

  const schema = generateSchema(config, endpoint, policy);
  const routePath = `/${variant}/custom-endpoints${endpoint.path.replace(/\/$/, '')}`;

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
      if (endpoint.handler.type === 'function') {
        return handleFunction(
          app,
          request,
          reply,
          endpoint.handler,
          artifactPath,
        );
      }
      return reply
        .status(500)
        .send(
          app.buildResponse(
            500,
            `Handler type "${(endpoint.handler as {type: string}).type}" not supported`,
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
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    summary: `Custom Endpoint: ${endpoint.path}`,
    description: endpoint.description,
    tags: policy.tags,
  };

  if (endpoint.handler.type === 'sql') {
    const {params, querystring, body} = buildSqlEndpoint(
      endpoint.handler.sql,
      endpoint.method,
      endpoint.validation,
    );
    if (params) schema.params = params;
    if (querystring) schema.querystring = querystring;
    if (body) schema.body = body;

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
  } else if (endpoint.handler.type === 'function') {
    const {params, querystring, body, headers} = buildFunctionEndpointSchema(
      endpoint.handler,
      endpoint.validation,
    );
    if (params) schema.params = params;
    if (querystring) schema.querystring = querystring;
    if (body) schema.body = body;
    if (headers) schema.headers = headers;

    schema.response = getResponseStructureSchema([200], {});
  }

  const security = buildSecurityArray(config, policy.authorization);

  if (security.length > 0) {
    schema.security = security;
  }

  return schema;
}
