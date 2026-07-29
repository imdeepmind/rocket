import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildSqlEndpoint,
  handleSql,
} from '@/routes/custom-endpoints/handlers/sql';
import {
  buildPreValidation,
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, CustomEndpointConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';

export function registerCustomEndpointRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const customEndpoints = config.customEndpoints;

  if (!customEndpoints) return;

  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  for (const [name, endpoint] of Object.entries(customEndpoints)) {
    const defaultApiIdentifier = `custom${getVariantSegment(config)}.all.unknown.${name}`;

    if (config.apis?.[defaultApiIdentifier]?.enabled === false) continue;

    const defaultAuthorization =
      config.apis?.[defaultApiIdentifier]?.authorization ??
      config.authentication?.enabled ??
      false;

    registerCustomEndpoint(
      app,
      config,
      name,
      endpoint,
      defaultVariant,
      defaultApiIdentifier,
      defaultAuthorization,
    );

    const baseIdentifier = buildApiIdentifier(
      'custom',
      defaultVariant,
      'all',
      'unknown',
      name,
    );
    const additionalVariants = getAdditionalVariants(config, baseIdentifier);

    for (const variant of additionalVariants) {
      const variantApiIdentifier = buildApiIdentifier(
        'custom',
        variant,
        'all',
        'unknown',
        name,
      );

      if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

      const variantAuthorization =
        config.apis?.[variantApiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;

      registerCustomEndpoint(
        app,
        config,
        name,
        endpoint,
        variant,
        variantApiIdentifier,
        variantAuthorization,
      );
    }
  }
}

function registerCustomEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  name: string,
  endpoint: CustomEndpointConfig,
  variant: string,
  apiIdentifier: string,
  authorization: boolean,
): void {
  const {schema, routePathSuffix} = generateSchema(
    config,
    endpoint,
    authorization,
  );
  const routePath = `/${variant}/custom-endpoints${endpoint.path.replace(/\/$/, '')}${routePathSuffix}`;

  app.route({
    method: endpoint.method,
    url: routePath,
    schema,
    config: {apiIdentifier},
    preValidation: buildPreValidation(app, config, authorization),
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
  config: AppConfig,
  endpoint: CustomEndpointConfig,
  authorization: boolean,
): {
  schema: Record<string, unknown>;
  routePathSuffix: string;
} {
  const schema: Record<string, unknown> = {
    summary: `Custom Endpoint: ${endpoint.path}`,
    description: endpoint.description,
    tags: ['Custom Endpoints'],
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

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }

  return {schema, routePathSuffix};
}
