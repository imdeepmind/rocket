import crypto from 'crypto';

import {FastifyInstance} from 'fastify';
import jwt from 'jsonwebtoken';

import {extractJwtRolePayload} from '@/lib/rbac';

import {ICache} from '@/interfaces/cache';
import {ResolvedAppConfig} from '@/interfaces/config';

import {
  SSO_EXCHANGE_AUDIENCE,
  SSO_EXCHANGE_CODE_TTL_SECONDS,
  SSO_EXCHANGE_INFO,
  SSO_EXCHANGE_ISSUER,
} from './constants';
import {deriveKey} from './state';

export interface ExchangeCodePayload {
  provider: string;
  subject: string;
  jti?: string;
}

function getSecret(config: ResolvedAppConfig): string {
  const {authentication} = config;

  if (!authentication.enabled || !authentication.jwtSecret) {
    throw new Error('Authentication is not enabled');
  }

  return authentication.jwtSecret;
}

/**
 * Issue the standard Rocket access token. Identical for every provider type -
 * this is the convergence point of the two authentication flows.
 */
export function issueAccessToken(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  user: Record<string, unknown>,
  usernameField?: string,
  roleUser: Record<string, unknown> = user,
): string {
  const {authentication} = config;

  if (!authentication.enabled || !authentication.userModel) {
    throw new Error('Authentication is not enabled');
  }

  const payload: Record<string, unknown> = {
    id: user[authentication.userModel.idField],
    ...extractJwtRolePayload(roleUser, config.rbac),
  };

  if (usernameField && user[usernameField] !== undefined) {
    payload[usernameField] = user[usernameField];
  }

  return app.jwt.sign(payload, {
    expiresIn: authentication.tokenExpiration,
  });
}

/**
 * Issue a short-lived, purpose-bound code that the browser carries back to the
 * frontend after an SSO callback. It is signed with a derived key, so it can
 * never be presented as an access token.
 */
export function issueExchangeCode(
  config: ResolvedAppConfig,
  provider: string,
  subject: string,
): string {
  return jwt.sign(
    {provider, sub: subject, jti: crypto.randomUUID()},
    deriveKey(getSecret(config), SSO_EXCHANGE_INFO),
    {
      expiresIn: SSO_EXCHANGE_CODE_TTL_SECONDS,
      issuer: SSO_EXCHANGE_ISSUER,
      audience: SSO_EXCHANGE_AUDIENCE,
    },
  );
}

export async function readExchangeCode(
  config: ResolvedAppConfig,
  provider: string,
  code: string,
  cache?: ICache,
): Promise<string> {
  const decoded = jwt.verify(
    code,
    deriveKey(getSecret(config), SSO_EXCHANGE_INFO),
    {
      issuer: SSO_EXCHANGE_ISSUER,
      audience: SSO_EXCHANGE_AUDIENCE,
    },
  );

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    (decoded as ExchangeCodePayload).provider !== provider ||
    typeof (decoded as {sub?: unknown}).sub !== 'string'
  ) {
    throw new Error('Invalid exchange code');
  }

  if (cache) {
    const jti =
      (decoded as {jti?: string}).jti ||
      /* c8 ignore next - fallback when code lacks jti */
      crypto.createHash('sha256').update(code).digest('hex');
    const cacheKey = `sso:exchange:${provider}:${jti}`;
    const alreadyUsed = await cache.get(cacheKey);

    if (alreadyUsed) {
      throw new Error('Exchange code has already been used');
    }

    await cache.set(cacheKey, '1', SSO_EXCHANGE_CODE_TTL_SECONDS);
  }

  return String((decoded as {sub: string}).sub);
}
