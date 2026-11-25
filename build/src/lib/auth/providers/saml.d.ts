import { FastifyRequest } from 'fastify';
import { ICache } from '../../../interfaces/cache.js';
import { ResolvedSsoProvider } from '../../../interfaces/config.js';
import { SsoStatePayload } from '../state.js';
import { ExternalIdentity } from '../types.js';
export declare function authorizeUrl(provider: ResolvedSsoProvider, callbackUrl: string, state: SsoStatePayload, cache?: ICache): Promise<string>;
export declare function handleCallback(provider: ResolvedSsoProvider, callbackUrl: string, _state: SsoStatePayload, request: FastifyRequest, cache?: ICache): Promise<ExternalIdentity>;
export declare function metadata(provider: ResolvedSsoProvider, callbackUrl: string): string;
