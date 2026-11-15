import {FastifyRequest} from 'fastify';
import * as client from 'openid-client';

import {
  ResolvedOidcSsoProvider,
  ResolvedSsoProvider,
} from '@/interfaces/config';

import {generatePkcePair, SsoStatePayload} from '../state';
import {ExternalIdentity} from '../types';

/**
 * Discovery documents and JWKS are cached per issuer. `openid-client` keeps the
 * JWKS internally; we only memoize the discovered configuration.
 */
const configurations = new Map<string, Promise<client.Configuration>>();

function configurationFor(
  provider: ResolvedOidcSsoProvider,
): Promise<client.Configuration> {
  const key = `${provider.name}|${provider.config.issuerUrl}`;
  const cached = configurations.get(key);

  if (cached) {
    return cached;
  }

  const created = client.discovery(
    new URL(provider.config.issuerUrl),
    provider.config.clientId,
    provider.config.clientSecret,
  );

  configurations.set(key, created);
  created.catch(() => configurations.delete(key));

  return created;
}

export function isOidc(
  provider: ResolvedSsoProvider,
): provider is ResolvedOidcSsoProvider {
  return provider.protocol === 'oidc';
}

export async function authorizeUrl(
  provider: ResolvedSsoProvider,
  callbackUrl: string,
  state: SsoStatePayload,
): Promise<string> {
  if (!isOidc(provider)) {
    throw new Error(`Provider ${provider.name} is not an OIDC provider`);
  }

  const {verifier, challenge} = generatePkcePair();
  state.verifier = verifier;

  const configuration = await configurationFor(provider);

  return client
    .buildAuthorizationUrl(configuration, {
      redirect_uri: callbackUrl,
      scope: provider.config.scopes.join(' '),
      state: state.state,
      nonce: state.nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    .toString();
}

export async function handleCallback(
  provider: ResolvedSsoProvider,
  callbackUrl: string,
  state: SsoStatePayload,
  request: FastifyRequest,
): Promise<ExternalIdentity> {
  if (!isOidc(provider)) {
    throw new Error(`Provider ${provider.name} is not an OIDC provider`);
  }

  const configuration = await configurationFor(provider);
  const currentUrl = new URL(callbackUrl);

  for (const [key, value] of Object.entries(
    request.query as Record<string, unknown>,
  )) {
    if (typeof value === 'string') {
      currentUrl.searchParams.set(key, value);
    }
  }

  const tokens = await client.authorizationCodeGrant(
    configuration,
    currentUrl,
    {
      ...(state.verifier ? {pkceCodeVerifier: state.verifier} : {}),
      expectedState: state.state,
      expectedNonce: state.nonce,
    },
  );

  const claims = tokens.claims();

  if (!claims || !claims.sub) {
    throw new Error('Identity provider did not return a subject');
  }

  return {
    provider: provider.name,
    providerId: String(claims.sub),
    claims: {...claims},
  };
}
