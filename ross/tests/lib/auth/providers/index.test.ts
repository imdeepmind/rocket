import {describe, expect, test} from 'vitest';

import {getAdapter} from '@/lib/auth/providers';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {
  buildEnabledAuth,
  oauth2Provider,
  oidcProvider,
  samlProvider,
} from '@tests/helpers/auth-config';

const providersOf = (providers: unknown[]): ResolvedSsoProvider[] => {
  const auth = buildEnabledAuth(providers).authentication;

  if (!auth.enabled) {
    throw new Error('expected enabled authentication');
  }

  return auth.providers as ResolvedSsoProvider[];
};

describe('getAdapter', () => {
  test('returns the OIDC adapter', () => {
    const [provider] = providersOf([oidcProvider]);

    expect(getAdapter(provider)).toHaveProperty('authorizeUrl');
  });

  test('returns the OAuth2 adapter', () => {
    const [provider] = providersOf([oauth2Provider]);

    expect(getAdapter(provider)).toHaveProperty('handleCallback');
  });

  test('returns the SAML adapter with metadata support', () => {
    const [provider] = providersOf([samlProvider]);

    expect(getAdapter(provider).metadata).toBeTypeOf('function');
  });

  test('rejects an unsupported protocol', () => {
    const [provider] = providersOf([oidcProvider]);
    const bogus = {
      ...provider,
      protocol: 'magic',
    } as unknown as ResolvedSsoProvider;

    expect(() => getAdapter(bogus)).toThrow('Unsupported SSO protocol');
  });
});
