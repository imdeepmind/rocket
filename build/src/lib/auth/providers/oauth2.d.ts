import { FastifyRequest } from 'fastify';
import { ResolvedSsoProvider } from '../../../interfaces/config.js';
import { SsoStatePayload } from '../state.js';
import { ExternalIdentity } from '../types.js';
export declare function authorizeUrl(provider: ResolvedSsoProvider, callbackUrl: string, state: SsoStatePayload): Promise<string>;
export declare function handleCallback(provider: ResolvedSsoProvider, callbackUrl: string, _state: SsoStatePayload, request: FastifyRequest): Promise<ExternalIdentity>;
