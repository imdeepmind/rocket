import { JWT } from '@fastify/jwt';
import { ICache } from '../../interfaces/cache.js';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export interface ExchangeCodePayload {
    provider: string;
    subject: string;
    jti?: string;
}
/**
 * Issue the standard Rocket access token. Identical for every provider type -
 * this is the convergence point of the two authentication flows.
 */
export declare function issueAccessToken(signer: Pick<JWT, 'sign'>, config: ResolvedAppConfig, user: Record<string, unknown>, usernameField?: string, roleUser?: Record<string, unknown>, providerIdField?: string): string;
/**
 * Issue a short-lived, purpose-bound code that the browser carries back to the
 * frontend after an SSO callback. It is signed with a derived key, so it can
 * never be presented as an access token.
 */
export declare function issueExchangeCode(config: ResolvedAppConfig, provider: string, subject: string): string;
export declare function readExchangeCode(config: ResolvedAppConfig, provider: string, code: string, cache?: ICache): Promise<string>;
