import { FastifyRequest } from 'fastify';
import { ICache } from '../../interfaces/cache.js';
import { ResolvedSsoProvider } from '../../interfaces/config.js';
import { SsoStatePayload } from './state.js';
import { ExternalIdentity } from './types.js';
export interface SsoAdapter {
    /**
     * Build the authorization redirect for a freshly created state payload.
     * Implementations may enrich `state` (e.g. attach a PKCE verifier) before the
     * caller seals it into the state cookie.
     */
    authorizeUrl(provider: ResolvedSsoProvider, callbackUrl: string, state: SsoStatePayload, cache?: ICache): Promise<string>;
    /** Validate the provider response and return the external identity. */
    handleCallback(provider: ResolvedSsoProvider, callbackUrl: string, state: SsoStatePayload, request: FastifyRequest, cache?: ICache): Promise<ExternalIdentity>;
    /** SP metadata document, for protocols that need one. */
    metadata?(provider: ResolvedSsoProvider, callbackUrl: string): string;
}
