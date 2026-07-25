import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildSqlEndpoint,
  handleSql,
} from '@/routes/custom-endpoints/handlers/sql';
import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, CustomEndpointConfig} from '@/interfaces/config';

export function registerCustomEndpointRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const customEndpoints = config.customEndpoints;

  if (!customEndpoints) return;

  for (const [name, endpoint] of Object.entries(customEndpoints)) {
    const apiIdentifier = `customEndpoints.${name}`;

    if (config.apis?.[apiIdentifier]?.enabled === false) continue;

    const authorization =
      config.apis?.[apiIdentifier]?.authorization ??
      config.authentication?.enabled ??
      false;

    const {schema, routePathSuffix} = generateSchema(
      config,
      endpoint,
      name,
      authorization,
    );
    const routePath = `/custom-endpoints${endpoint.path.replace(/\/$/, '')}${routePathSuffix}`;

    app.route({
      method: endpoint.method,
      url: routePath,
      schema,
      config: {apiIdentifier},
      preValidation: async (request, reply) => {
        if (config.authentication?.enabled && authorization) {
          try {
            await request.authenticate();
          } catch {
            return reply
              .status(401)
              .send(
                app.buildResponse(
                  401,
                  'Invalid or expired authentication token',
                  null,
                ),
              );
          }
        }
        app.enforceSSP(request);
      },
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
}

function generateSchema(
  config: AppConfig,
  endpoint: CustomEndpointConfig,
  name: string,
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

  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.authentication?.enabled &&
    config.authentication?.provider.type === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  if (security.length > 0) {
    schema.security = security;
  }

  return {schema, routePathSuffix};
}
