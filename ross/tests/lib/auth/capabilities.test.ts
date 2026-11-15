import {describe, expect, test} from 'vitest';

import {
  getProviderCapabilities,
  getProviderName,
} from '@/lib/auth/capabilities';

import {
  buildEnabledAuth,
  oauth2Provider,
  oidcProvider,
  samlProvider,
  upAuthProvider,
} from '@tests/helpers/auth-config';

const providersOf = (providers: unknown[]) => {
  const resolved = buildEnabledAuth(providers).authentication;

  if (!resolved.enabled) {
    throw new Error('expected enabled authentication');
  }

  return resolved.providers as Parameters<typeof getProviderCapabilities>[0][];
};

describe('getProviderCapabilities', () => {
  test('password providers can log in and register', () => {
    const [provider] = providersOf([upAuthProvider]);

    expect(getProviderCapabilities(provider)).toEqual(['password', 'register']);
  });

  test('password providers with MFA advertise it', () => {
    const [provider] = providersOf([
      {
        ...upAuthProvider,
        config: {...upAuthProvider.config, mfaRequired: true},
      },
    ]);

    expect(getProviderCapabilities(provider)).toContain('mfa');
  });

  test('api-key providers have no auth capabilities', () => {
    const [provider] = providersOf([{type: 'api-key', config: {key: 'k'}}]);

    expect(getProviderCapabilities(provider)).toEqual([]);
  });

  test('oidc providers initiate without metadata', () => {
    const [provider] = providersOf([oidcProvider]);
    const capabilities = getProviderCapabilities(provider);

    expect(capabilities).toContain('initiate');
    expect(capabilities).toContain('callback');
    expect(capabilities).not.toContain('metadata');
    expect(capabilities).not.toContain('token-exchange');
  });

  test('redirectUrl enables the token exchange', () => {
    const [provider] = providersOf([
      {
        ...oidcProvider,
        config: {
          ...oidcProvider.config,
          redirectUrl: 'https://app.example.com/done',
        },
      },
    ]);

    expect(getProviderCapabilities(provider)).toContain('token-exchange');
  });

  test('saml providers expose metadata', () => {
    const [provider] = providersOf([samlProvider]);

    expect(getProviderCapabilities(provider)).toContain('metadata');
  });

  test('oauth2 providers are supported', () => {
    const [provider] = providersOf([oauth2Provider]);

    expect(getProviderCapabilities(provider)).toContain('initiate');
  });
});

describe('getProviderName', () => {
  test('uses the type for built-in providers', () => {
    const [upAuth, apiKey] = providersOf([
      upAuthProvider,
      {type: 'api-key', config: {key: 'k'}},
    ]);

    expect(getProviderName(upAuth)).toBe('up-auth');
    expect(getProviderName(apiKey)).toBe('api-key');
  });

  test('uses the configured name for SSO providers', () => {
    const [provider] = providersOf([oidcProvider]);

    expect(getProviderName(provider)).toBe('google');
  });
});
