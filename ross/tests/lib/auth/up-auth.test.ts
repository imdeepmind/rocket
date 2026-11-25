import {describe, expect, test} from 'vitest';

import {
  getActiveUserModel,
  getAuthModel,
  getSsoProviders,
  getUpAuth,
} from '@/lib/auth/up-auth';

import {
  buildEnabledAuth,
  oidcProvider,
  upAuthProvider,
} from '@tests/helpers/auth-config';

describe('getUpAuth', () => {
  test('projects the resolved up-auth provider', () => {
    const config = buildEnabledAuth([upAuthProvider]);
    const upAuth = getUpAuth(config);

    expect(upAuth).toMatchObject({
      model: 'users',
      idField: 'id',
      providerField: 'provider',
      usernameField: 'email',
      passwordField: 'password',
      mfaRequired: false,
    });
    expect(upAuth?.isVerifiedField).toBeUndefined();
  });

  test('exposes the verification field when configured', () => {
    const config = buildEnabledAuth([
      {
        ...upAuthProvider,
        config: {
          ...upAuthProvider.config,
          fields: {
            ...upAuthProvider.config.fields,
            isVerifiedField: 'is_active',
          },
        },
      },
    ]);

    expect(getUpAuth(config)?.isVerifiedField).toBe('is_active');
  });

  test('returns null without an up-auth provider', () => {
    expect(getUpAuth(buildEnabledAuth([oidcProvider]))).toBeNull();
  });

  test('returns null when auth is disabled', () => {
    expect(getUpAuth(buildEnabledAuth([]))).toBeNull();
  });

  test('returns null when a resolved config has no user model', () => {
    expect(
      getUpAuth({
        authentication: {
          enabled: true,
          accessTokenExpiration: '15m',
          refreshTokenExpiration: '7d',
          sessionStorage: 'db',
          providers: [
            {
              type: 'up-auth',
              config: {
                fields: {usernameField: 'email', passwordField: 'pw'},
                mfaRequired: false,
              },
            },
          ],
        },
      } as never),
    ).toBeNull();
  });
});

describe('getSsoProviders', () => {
  test('returns only SSO providers', () => {
    const config = buildEnabledAuth([upAuthProvider, oidcProvider]);

    expect(getSsoProviders(config).map(provider => provider.name)).toEqual([
      'google',
    ]);
  });

  test('returns an empty list when disabled', () => {
    expect(getSsoProviders(buildEnabledAuth([]))).toEqual([]);
  });
});

describe('getAuthModel / getActiveUserModel', () => {
  test('returns the model when an identity provider exists', () => {
    const config = buildEnabledAuth([upAuthProvider]);

    expect(getAuthModel(config)).toBe('users');
    expect(getActiveUserModel(config)?.providerField).toBe('provider');
  });

  test('returns null for api-key only', () => {
    const config = buildEnabledAuth([{type: 'api-key', config: {key: 'k'}}]);

    expect(getAuthModel(config)).toBeNull();
    expect(getActiveUserModel(config)).toBeNull();
  });

  test('returns null when disabled', () => {
    expect(getAuthModel(buildEnabledAuth([]))).toBeNull();
  });
});
