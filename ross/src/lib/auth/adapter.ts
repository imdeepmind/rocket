import {FastifyInstance, FastifyRequest} from 'fastify';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {SsoStatePayload} from './state';
import {ExternalIdentity} from './types';

export interface SsoAdapter {
  /**
   * Build the authorization redirect for a freshly created state payload.
   * Implementations may enrich `state` (e.g. attach a PKCE verifier) before the
   * caller seals it into the state cookie.
   */
  authorizeUrl(
    app: FastifyInstance,
    provider: ResolvedSsoProvider,
    callbackUrl: string,
    state: SsoStatePayload,
  ): Promise<string>;

  /** Validate the provider response and return the external identity. */
  handleCallback(
    app: FastifyInstance,
    provider: ResolvedSsoProvider,
    callbackUrl: string,
    state: SsoStatePayload,
    request: FastifyRequest,
  ): Promise<ExternalIdentity>;

  /** SP metadata document, for protocols that need one. */
  metadata?(provider: ResolvedSsoProvider, callbackUrl: string): string;
}
