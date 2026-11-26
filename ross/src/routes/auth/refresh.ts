import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {revokeSession, rotateSession} from '@/lib/auth/session';
import {issueAccessToken} from '@/lib/auth/token';
import {
  getActiveUserModel,
  getSsoProviders,
  getUpAuth,
} from '@/lib/auth/up-auth';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {ResolvedAppConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerRefreshRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const userModel = getActiveUserModel(config);

  if (!userModel) {
    return;
  }

  const {modelName: model, idField, providerField} = userModel;

  if (!config.data.models[model]) {
    return;
  }

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    'refresh',
  );

  for (const {identifier, variant, policy} of targets) {
    registerRefreshEndpoint(
      app,
      config,
      model,
      idField,
      providerField,
      variant,
      identifier,
      policy,
    );
  }
}

function resolveTokenFields(
  config: ResolvedAppConfig,
  user: Record<string, unknown>,
  providerField: string,
): {usernameField?: string; providerIdField?: string} {
  const providerValue = user[providerField];
  const ssoProvider = getSsoProviders(config).find(
    provider => provider.name === providerValue,
  );

  if (ssoProvider) {
    return {
      usernameField: ssoProvider.config.fields.usernameField,
      providerIdField: ssoProvider.config.fields.providerIdField,
    };
  }

  const upAuth = getUpAuth(config);
  if (upAuth) {
    return {usernameField: upAuth.emailField};
  }

  return {};
}

function registerRefreshEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  idField: string,
  providerField: string,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema = generateSchema(model, policy);
  const path = `/${variant}/auth/refresh`;

  app.post(
    path,
    {
      schema,
      config: {apiIdentifier},
    },
    async (
      request: FastifyRequest<{Body: {refreshToken?: string}}>,
      reply: FastifyReply,
    ) => {
      const refreshToken = request.body?.refreshToken;

      if (!refreshToken || typeof refreshToken !== 'string') {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'Invalid or expired refresh token', null),
          );
      }

      const rotated = await rotateSession(app, config, refreshToken);

      if (!rotated) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'Invalid or expired refresh token', null),
          );
      }

      const res = await app.db.query<Record<string, unknown>>(
        `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`,
        [rotated.userId],
      );

      const user = res.rows[0];

      if (!user) {
        await revokeSession(app, config, rotated.refreshToken);
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'Invalid or expired refresh token', null),
          );
      }

      let rbacUser = user;
      if (
        config.rbac?.enabled &&
        config.rbac.modelName &&
        config.rbac.modelName !== model
      ) {
        const rbacRes = await app.db.query<Record<string, unknown>>(
          `SELECT * FROM "${config.rbac.modelName}" WHERE "${idField}" = $1 LIMIT 1;`,
          [user[idField]],
        );
        rbacUser = rbacRes.rows[0] ?? user;
      }

      const {usernameField, providerIdField} = resolveTokenFields(
        config,
        user,
        providerField,
      );

      const accessToken = issueAccessToken(
        app.jwt,
        config,
        user,
        usernameField,
        rbacUser,
        providerIdField,
      );

      return reply.status(200).send(
        app.buildResponse(200, 'Token refreshed successfully', {
          accessToken,
          refreshToken: rotated.refreshToken,
        }),
      );
    },
  );
}

function generateSchema(model: string, policy: ResolvedApiPolicy) {
  return {
    summary: `Refresh token for ${capitalizeFirstLetter(model)}`,
    description:
      'Validates a refresh token and returns a new access token and rotated refresh token.',
    tags: policy.tags,
    body: {
      type: 'object',
      properties: {
        refreshToken: {type: 'string', description: 'Refresh token'},
      },
      additionalProperties: false,
    },
    response: getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        accessToken: {type: 'string', description: 'JWT access token'},
        refreshToken: {type: 'string', description: 'Rotated refresh token'},
      },
    }),
  };
}
