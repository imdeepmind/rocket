import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {resolveCallbackUrl} from '@/lib/auth/callback-url';
import {SSO_STATE_INFO} from '@/lib/auth/constants';
import {
  clearStateCookie,
  readStateCookie,
  setStateCookie,
} from '@/lib/auth/cookie';
import {getAdapter} from '@/lib/auth/providers';
import {buildRedirectUrl} from '@/lib/auth/redirect';
import {
  openState,
  randomToken,
  safeEqual,
  sealState,
  SsoStatePayload,
} from '@/lib/auth/state';
import {
  issueAccessToken,
  issueExchangeCode,
  readExchangeCode,
} from '@/lib/auth/token';
import {getSsoProviders} from '@/lib/auth/up-auth';
import {resolveUserByIdentity} from '@/lib/auth/user';
import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {getResponseStructureSchema} from '@/lib/schema/response';

import {ResolvedAppConfig, ResolvedSsoProvider} from '@/interfaces/config';

type SsoOperation = 'ssoLogin' | 'ssoCallback' | 'ssoToken' | 'ssoMetadata';

export function registerSsoRoutes(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const providers = getSsoProviders(config);

  if (providers.length === 0) {
    return;
  }

  const {authentication} = config;

  /* c8 ignore start - a non-empty SSO list implies enabled authentication */
  if (!authentication.enabled) {
    return;
  }

  const authModel = authentication.userModel?.modelName;

  if (!authModel) {
    return;
  }
  /* c8 ignore stop */

  const operations: SsoOperation[] = [
    'ssoLogin',
    'ssoCallback',
    'ssoToken',
    'ssoMetadata',
  ];

  for (const operation of operations) {
    const targets = getApiRouteTargets(
      config,
      'auth',
      authModel,
      'unknown',
      operation,
    );

    if (targets.length === 0) {
      continue;
    }

    for (const {identifier, variant, policy} of targets) {
      for (const provider of providers) {
        registerProviderOperation(
          app,
          config,
          provider,
          operation,
          variant,
          identifier,
          policy,
        );
      }
    }
  }
}

function registerProviderOperation(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  provider: ResolvedSsoProvider,
  operation: SsoOperation,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const base = `/${variant}/auth/sso/${provider.name}`;

  switch (operation) {
    case 'ssoLogin':
      app.get(
        `${base}/login`,
        {
          schema: buildSchema('Start an SSO login', policy),
          config: {apiIdentifier},
        },
        async (request: FastifyRequest, reply: FastifyReply) =>
          startLogin(app, config, provider, request, reply),
      );
      return;

    case 'ssoCallback':
      if (provider.protocol === 'saml') {
        app.post(
          `${base}/callback`,
          {
            schema: buildSchema('SAML assertion consumer service', policy),
            config: {apiIdentifier},
          },
          async (request: FastifyRequest, reply: FastifyReply) =>
            completeLogin(app, config, provider, request, reply),
        );
        return;
      }

      app.get(
        `${base}/callback`,
        {
          schema: buildSchema('Complete an SSO login', policy),
          config: {apiIdentifier},
        },
        async (request: FastifyRequest, reply: FastifyReply) =>
          completeLogin(app, config, provider, request, reply),
      );
      return;

    case 'ssoToken':
      if (!provider.config.redirectUrl) {
        return;
      }

      app.post(
        `${base}/token`,
        {
          schema: buildTokenSchema(policy),
          config: {apiIdentifier},
        },
        async (request: FastifyRequest, reply: FastifyReply) =>
          exchange(app, config, provider, request, reply),
      );
      return;

    case 'ssoMetadata':
      if (provider.protocol !== 'saml') {
        return;
      }

      app.get(
        `${base}/metadata`,
        {
          schema: buildSchema('SAML service provider metadata', policy),
          config: {apiIdentifier},
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          const callbackUrl = resolveCallbackUrl(request, provider);
          const metadata = getAdapter(provider).metadata?.(
            provider,
            callbackUrl,
          );

          if (!metadata) {
            return reply
              .status(404)
              .send(app.buildResponse(404, 'Metadata is not available', null));
          }

          return reply.type('application/xml').send(metadata);
        },
      );
  }
}

async function startLogin(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  provider: ResolvedSsoProvider,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const secret = jwtSecret(config);

  if (!secret) {
    return reply
      .status(500)
      .send(app.buildResponse(500, 'Authentication is not configured', null));
  }

  const callbackUrl = resolveCallbackUrl(request, provider);
  const state = {
    state: randomToken(),
    nonce: randomToken(),
    provider: provider.name,
    issuedAt: Date.now(),
  };

  const url = await getAdapter(provider).authorizeUrl(
    app,
    provider,
    callbackUrl,
    state,
  );

  // The adapter may have attached a PKCE verifier; seal only after that.
  setStateCookie(
    reply,
    provider.name,
    sealState(secret, SSO_STATE_INFO, state),
  );

  return reply.redirect(url, 302);
}

async function completeLogin(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  provider: ResolvedSsoProvider,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const secret = jwtSecret(config);
  const fail = (reason: string): FastifyReply =>
    failure(app, provider, reply, reason);

  if (!secret) {
    return reply
      .status(500)
      .send(app.buildResponse(500, 'Authentication is not configured', null));
  }

  let state: SsoStatePayload;

  if (provider.protocol === 'saml') {
    // The SAML ACS is a cross-site POST, so `SameSite=Lax` cookies are not
    // sent. Correlation is handled by node-saml through the cache-backed
    // `InResponseTo` check instead of the state cookie.
    const relayState = (request.body as {RelayState?: string} | undefined)
      ?.RelayState;

    state = {
      state: relayState ?? '',
      nonce: '',
      provider: provider.name,
      issuedAt: Date.now(),
    };
  } else {
    const sealed = readStateCookie(request, provider.name);
    clearStateCookie(reply, provider.name);

    if (!sealed) {
      return fail('missing_state');
    }

    try {
      state = openState(secret, SSO_STATE_INFO, sealed);
    } catch {
      return fail('invalid_state');
    }

    /* c8 ignore start - the state cookie is provider scoped */
    if (state.provider !== provider.name) {
      return fail('invalid_state');
    }
    /* c8 ignore stop */

    const queryState = (request.query as Record<string, unknown>).state;

    if (typeof queryState !== 'string' || !safeEqual(queryState, state.state)) {
      return fail('invalid_state');
    }
  }

  const {authentication} = config;

  /* c8 ignore start - a registered SSO route implies a user model */
  if (!authentication.enabled || !authentication.userModel) {
    return fail('not_configured');
  }
  /* c8 ignore stop */

  const callbackUrl = resolveCallbackUrl(request, provider);

  let identity;

  try {
    identity = await getAdapter(provider).handleCallback(
      app,
      provider,
      callbackUrl,
      state,
      request,
    );
  } catch {
    return fail('provider_error');
  }

  try {
    const user = await resolveUserByIdentity(app, {
      model: authentication.userModel.modelName,
      providerField: authentication.userModel.providerField,
      providerName: provider.name,
      providerIdField: provider.config.fields.providerIdField,
      providerId: identity.providerId,
      attributeMapping: provider.config.attributeMapping,
      claims: identity.claims,
    });

    if (provider.config.redirectUrl) {
      const subject = String(user[authentication.userModel.idField]);
      const code = issueExchangeCode(config, provider.name, subject);

      return reply.redirect(
        buildRedirectUrl(provider.config.redirectUrl, {code}),
        302,
      );
    }

    const accessToken = issueAccessToken(app, config, user);

    return reply
      .status(200)
      .send(
        app.buildResponse(200, 'SSO authentication successful', {accessToken}),
      );
  } catch {
    return fail('user_resolution_failed');
  }
}

async function exchange(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  provider: ResolvedSsoProvider,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const {code} = request.body as {code: string};

  let subject: string;

  try {
    subject = readExchangeCode(config, provider.name, code);
  } catch {
    return reply
      .status(401)
      .send(app.buildResponse(401, 'Invalid or expired code', null));
  }

  const {authentication} = config;

  /* c8 ignore start - a registered SSO route implies a user model */
  if (!authentication.enabled || !authentication.userModel) {
    return reply
      .status(500)
      .send(app.buildResponse(500, 'Authentication is not configured', null));
  }
  /* c8 ignore stop */

  const {modelName, idField} = authentication.userModel;
  const result = await app.db.query<Record<string, unknown>>(
    `SELECT * FROM "${modelName}" WHERE "${idField}" = $1 LIMIT 1;`,
    [subject],
  );

  const user = result.rows[0];

  if (!user) {
    return reply
      .status(401)
      .send(app.buildResponse(401, 'Invalid or expired code', null));
  }

  const accessToken = issueAccessToken(app, config, user);

  return reply
    .status(200)
    .send(
      app.buildResponse(200, 'SSO authentication successful', {accessToken}),
    );
}

function failure(
  app: FastifyInstance,
  provider: ResolvedSsoProvider,
  reply: FastifyReply,
  reason: string,
): FastifyReply {
  if (provider.config.redirectUrl) {
    const target =
      provider.config.failureRedirectUrl ?? provider.config.redirectUrl;

    return reply.redirect(buildRedirectUrl(target, {error: reason}), 302);
  }

  return reply
    .status(400)
    .send(app.buildResponse(400, 'SSO authentication failed', null));
}

function jwtSecret(config: ResolvedAppConfig): string | undefined {
  const {authentication} = config;

  /* c8 ignore next - SSO routes only exist when authentication is enabled */
  if (!authentication.enabled) {
    return undefined;
  }

  return authentication.jwtSecret;
}

function buildSchema(summary: string, policy: ResolvedApiPolicy) {
  return {
    summary,
    tags: policy.tags,
  };
}

function buildTokenSchema(policy: ResolvedApiPolicy) {
  return {
    summary: 'Exchange a one-time code for an access token',
    tags: policy.tags,
    body: {
      type: 'object',
      required: ['code'],
      additionalProperties: false,
      properties: {
        code: {type: 'string', description: 'One-time SSO exchange code'},
      },
    },
    response: getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        accessToken: {type: 'string', description: 'JWT access token'},
      },
    }),
  };
}
