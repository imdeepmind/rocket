import { FastifyRequest } from 'fastify';
import { ResolvedSsoProvider } from '../../interfaces/config.js';
/**
 * Resolve the absolute callback URL for a provider.
 *
 * When the provider does not pin one, it is derived from the request that
 * started the flow. Deriving per request keeps the value correct for every API
 * variant and reverse-proxy mount point; the identity provider will reject the
 * value if it does not match its registration, so a spoofed host cannot be used
 * to hijack the exchange.
 */
export declare function resolveCallbackUrl(request: FastifyRequest, provider: ResolvedSsoProvider): string;
