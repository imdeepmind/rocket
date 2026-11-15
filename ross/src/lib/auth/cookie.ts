import {FastifyReply} from 'fastify';

import {SSO_COOKIE_PREFIX, SSO_STATE_TTL_SECONDS} from './constants';

export function stateCookieName(provider: string): string {
  return `${SSO_COOKIE_PREFIX}${provider}`;
}

/**
 * Cookies are `__Host-` prefixed, so `path` must be `/`, `secure` must be on
 * and no `domain` may be set. `SameSite=Lax` is required for the OIDC callback,
 * which arrives as a top-level GET navigation.
 */
export function setStateCookie(
  reply: FastifyReply,
  provider: string,
  value: string,
): void {
  reply.setCookie(stateCookieName(provider), value, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SSO_STATE_TTL_SECONDS,
  });
}

export function clearStateCookie(reply: FastifyReply, provider: string): void {
  reply.clearCookie(stateCookieName(provider), {path: '/'});
}

export function readStateCookie(
  request: {cookies?: Record<string, string | undefined>},
  provider: string,
): string | undefined {
  return request.cookies?.[stateCookieName(provider)];
}
