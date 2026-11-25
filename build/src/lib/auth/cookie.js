import { SSO_COOKIE_PREFIX, SSO_STATE_TTL_SECONDS } from './constants.js';
export function stateCookieName(provider) {
    return `${SSO_COOKIE_PREFIX}${provider}`;
}
/**
 * Cookies are `__Host-` prefixed, so `path` must be `/`, `secure` must be on
 * and no `domain` may be set. `SameSite=Lax` is required for the OIDC callback,
 * which arrives as a top-level GET navigation.
 */
export function setStateCookie(reply, provider, value) {
    reply.setCookie(stateCookieName(provider), value, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SSO_STATE_TTL_SECONDS,
    });
}
export function clearStateCookie(reply, provider) {
    reply.clearCookie(stateCookieName(provider), { path: '/' });
}
export function readStateCookie(request, provider) {
    return request.cookies?.[stateCookieName(provider)];
}
//# sourceMappingURL=cookie.js.map