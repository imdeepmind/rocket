import { FastifyReply } from 'fastify';
export declare function stateCookieName(provider: string): string;
/**
 * Cookies are `__Host-` prefixed, so `path` must be `/`, `secure` must be on
 * and no `domain` may be set. `SameSite=Lax` is required for the OIDC callback,
 * which arrives as a top-level GET navigation.
 */
export declare function setStateCookie(reply: FastifyReply, provider: string, value: string): void;
export declare function clearStateCookie(reply: FastifyReply, provider: string): void;
export declare function readStateCookie(request: {
    cookies?: Record<string, string | undefined>;
}, provider: string): string | undefined;
