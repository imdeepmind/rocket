import {FastifyInstance, FastifyRequest} from 'fastify';

import {
  ResolvedOAuth2SsoProvider,
  ResolvedSsoProvider,
} from '@/interfaces/config';

import {randomToken, SsoStatePayload} from '../state';
import {ExternalIdentity} from '../types';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function isOAuth2(
  provider: ResolvedSsoProvider,
): provider is ResolvedOAuth2SsoProvider {
  return provider.protocol === 'oauth2';
}

async function requestToken(
  provider: ResolvedOAuth2SsoProvider,
  callbackUrl: string,
  code: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: provider.config.clientId,
    client_secret: provider.config.clientSecret,
  });

  const response = await fetch(provider.config.tokenUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Token endpoint rejected the authorization code');
  }

  const payload = (await response.json()) as TokenResponse;

  if (!payload.access_token) {
    throw new Error('Token endpoint did not return an access token');
  }

  return payload.access_token;
}

async function requestClaims(
  provider: ResolvedOAuth2SsoProvider,
  accessToken: string,
): Promise<Record<string, unknown>> {
  if (!provider.config.userInfoUrl) {
    return {};
  }

  const response = await fetch(provider.config.userInfoUrl, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Userinfo endpoint rejected the access token');
  }

  return (await response.json()) as Record<string, unknown>;
}

function extractSubject(
  provider: ResolvedOAuth2SsoProvider,
  claims: Record<string, unknown>,
): string | undefined {
  const candidates = provider.config.idClaim
    ? [provider.config.idClaim]
    : ['sub', 'id', 'user_id', 'login'];

  for (const candidate of candidates) {
    const value = claims[candidate];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return undefined;
}

export async function authorizeUrl(
  _app: FastifyInstance,
  provider: ResolvedSsoProvider,
  callbackUrl: string,
  state: SsoStatePayload,
): Promise<string> {
  if (!isOAuth2(provider)) {
    throw new Error(`Provider ${provider.name} is not an OAuth2 provider`);
  }

  state.nonce = randomToken();

  const url = new URL(provider.config.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.config.clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state.state);

  if (provider.config.scopes.length > 0) {
    url.searchParams.set('scope', provider.config.scopes.join(' '));
  }

  return url.toString();
}

export async function handleCallback(
  _app: FastifyInstance,
  provider: ResolvedSsoProvider,
  callbackUrl: string,
  _state: SsoStatePayload,
  request: FastifyRequest,
): Promise<ExternalIdentity> {
  if (!isOAuth2(provider)) {
    throw new Error(`Provider ${provider.name} is not an OAuth2 provider`);
  }

  const query = request.query as Record<string, unknown>;
  const code = query.code;

  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('Authorization response did not include a code');
  }

  const accessToken = await requestToken(provider, callbackUrl, code);
  const claims = await requestClaims(provider, accessToken);
  const subject = extractSubject(provider, claims);

  if (!subject) {
    throw new Error('Identity provider did not return a subject');
  }

  return {
    provider: provider.name,
    providerId: subject,
    claims,
  };
}
