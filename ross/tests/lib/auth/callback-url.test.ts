import {describe, expect, test} from 'vitest';

import {resolveCallbackUrl} from '@/lib/auth/callback-url';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {buildEnabledAuth, oidcProvider} from '@tests/helpers/auth-config';

const auth = buildEnabledAuth([oidcProvider]).authentication;

if (!auth.enabled) {
  throw new Error('expected authentication to be enabled');
}

const sso = auth.providers[0] as ResolvedSsoProvider;

const buildRequest = (url: string, host = 'api.example.com') => ({
  url,
  protocol: 'https',
  hostname: host,
  headers: {host},
});

describe('resolveCallbackUrl', () => {
  test('derives the callback from the login request', () => {
    expect(
      resolveCallbackUrl(
        buildRequest('/api/v1/auth/sso/google/login') as never,
        sso,
      ),
    ).toBe('https://api.example.com/api/v1/auth/sso/google/callback');
  });

  test('derives the callback from the metadata request', () => {
    expect(
      resolveCallbackUrl(
        buildRequest(
          '/api/v1/auth/sso/google/metadata',
          'sp.example.com',
        ) as never,
        sso,
      ),
    ).toBe('https://sp.example.com/api/v1/auth/sso/google/callback');
  });

  test('prefers the configured callbackUrl', () => {
    const configured = {
      ...sso,
      config: {
        ...sso.config,
        callbackUrl: 'https://configured.example.com/cb',
      },
    } as ResolvedSsoProvider;

    expect(
      resolveCallbackUrl(
        buildRequest('/api/v1/auth/sso/google/login') as never,
        configured,
      ),
    ).toBe('https://configured.example.com/cb');
  });

  test('falls back to request.hostname without a host header', () => {
    expect(
      resolveCallbackUrl(
        {
          url: '/api/v1/auth/sso/google/login?x=1',
          protocol: 'https',
          hostname: 'fallback.example.com',
          headers: {},
        } as never,
        sso,
      ),
    ).toBe('https://fallback.example.com/api/v1/auth/sso/google/callback');
  });
});
