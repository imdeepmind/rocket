import {describe, expect, test} from 'vitest';

import {buildProviderDescriptors} from '@/lib/auth/discovery';

import {
  buildEnabledAuth,
  oauth2Provider,
  oidcProvider,
  upAuthProvider,
} from '@tests/helpers/auth-config';

describe('buildProviderDescriptors', () => {
  test('returns nothing when auth is disabled', () => {
    expect(buildProviderDescriptors(buildEnabledAuth([]), '/api/v1')).toEqual(
      [],
    );
  });

  test('describes the password provider', () => {
    const [descriptor] = buildProviderDescriptors(
      buildEnabledAuth([upAuthProvider]),
      '/api/v1',
    );

    expect(descriptor).toEqual({
      type: 'up-auth',
      capabilities: ['password', 'register'],
      login: {method: 'POST', url: '/api/v1/auth/login'},
    });
  });

  test('describes api-key without a login endpoint', () => {
    const [descriptor] = buildProviderDescriptors(
      buildEnabledAuth([{type: 'api-key', config: {key: 'k'}}]),
      '/api/v1',
    );

    expect(descriptor).toEqual({type: 'api-key', capabilities: []});
    expect(descriptor.login).toBeUndefined();
  });

  test('describes SSO providers with their login URL', () => {
    const descriptors = buildProviderDescriptors(
      buildEnabledAuth([oidcProvider, oauth2Provider]),
      '/api/v2',
    );

    expect(descriptors[0]).toMatchObject({
      type: 'sso',
      name: 'google',
      protocol: 'oidc',
      login: {method: 'GET', url: '/api/v2/auth/sso/google/login'},
    });
    expect(descriptors[1]).toMatchObject({
      type: 'sso',
      name: 'github',
      protocol: 'oauth2',
    });
  });
});
