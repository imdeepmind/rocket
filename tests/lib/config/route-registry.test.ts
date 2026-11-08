import {describe, expect, test} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';
import {
  getGeneratedApiIdentifiers,
  isGeneratedApiIdentifier,
} from '@/lib/config/route-registry';

import {AppConfig, AppConfigInput} from '@/interfaces/config';

const baseInput = (
  overrides: Partial<AppConfigInput> = {},
): AppConfigInput => ({
  application: {name: 'Registry Test'},
  data: {
    models: {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          email: {type: 'string', apis: ['search', 'edit']},
          secret_token: {type: 'string'},
        },
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          title: {
            type: 'string',
            apis: ['search', 'index', 'edit', 'delete'],
            aggregations: ['count'],
          },
        },
      },
    },
  },
  ...overrides,
});

const resolve = (overrides: Partial<AppConfigInput> = {}) =>
  resolveConfig(baseInput(overrides), {mode: 'dev'});

const upAuth = {
  enabled: true as const,
  provider: {
    type: 'up-auth' as const,
    config: {
      userModel: {
        model: 'users',
        idField: 'id',
        usernameField: 'email',
        passwordField: 'secret_token',
      },
      jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
    },
  },
};

describe('getGeneratedApiIdentifiers', () => {
  test('enumerates model routes per field capability', () => {
    const ids = getGeneratedApiIdentifiers(resolve());

    // model-level routes always exist
    expect(ids.has('model.v1.users.unknown.insert')).toBe(true);
    expect(ids.has('model.v1.users.unknown.getAll')).toBe(true);
    expect(ids.has('model.v1.posts.unknown.insert')).toBe(true);

    // index: primaryKey or explicit apis
    expect(ids.has('model.v1.users.id.index')).toBe(true);
    expect(ids.has('model.v1.posts.title.index')).toBe(true);

    // field-op capability
    expect(ids.has('model.v1.users.email.search')).toBe(true);
    expect(ids.has('model.v1.users.email.edit')).toBe(true);
    expect(ids.has('model.v1.users.email.delete')).toBe(false);
    expect(ids.has('model.v1.users.secret_token.search')).toBe(false);

    // aggregate only for fields with aggregations
    expect(ids.has('aggregate.v1.posts.title.getAggregation')).toBe(true);
    expect(ids.has('aggregate.v1.users.id.getAggregation')).toBe(false);
  });

  test('includes configured variant identifiers', () => {
    const ids = getGeneratedApiIdentifiers(
      resolve({
        apis: {},
        apiVariants: {
          'model.v1.posts.title.search': {variants: ['admin', 'beta']},
        },
      }),
    );

    expect(ids.has('model.v1.posts.title.search')).toBe(true);
    expect(ids.has('model.admin.posts.title.search')).toBe(true);
    expect(ids.has('model.beta.posts.title.search')).toBe(true);
    expect(ids.has('model.admin.users.email.search')).toBe(false);
  });

  test('includes custom endpoint identifiers and their variants', () => {
    const ids = getGeneratedApiIdentifiers(
      resolve({
        customEndpoints: {
          searchUsers: {
            method: 'GET',
            path: '/search',
            description: 'Search users',
            handler: {type: 'sql', sql: 'SELECT * FROM users'},
          },
        },
        apiVariants: {
          'custom.v1.all.unknown.searchUsers': {variants: ['admin']},
        },
      }),
    );

    expect(ids.has('custom.v1.all.unknown.searchUsers')).toBe(true);
    expect(ids.has('custom.admin.all.unknown.searchUsers')).toBe(true);
  });

  test('includes no auth identifiers when auth is disabled', () => {
    const ids = getGeneratedApiIdentifiers(resolve());

    expect([...ids].some(id => id.startsWith('auth.'))).toBe(false);
  });

  test('includes base auth routes when up-auth is enabled', () => {
    const ids = getGeneratedApiIdentifiers(resolve({authentication: upAuth}));

    for (const operation of [
      'registration',
      'login',
      'changePassword',
      'me',
      'deleteMe',
      'editMe',
    ]) {
      expect(ids.has(`auth.v1.users.unknown.${operation}`)).toBe(true);
    }

    expect(ids.has('auth.v1.users.unknown.forgotPassword')).toBe(false);
    expect(ids.has('auth.v1.users.unknown.otpVerifyLogin')).toBe(false);
  });

  test('gates email-dependent auth routes on integrations.email', () => {
    const ids = getGeneratedApiIdentifiers(
      resolve({
        authentication: upAuth,
        integrations: {email: {provider: 'dummy'}},
      }),
    );

    expect(ids.has('auth.v1.users.unknown.forgotPassword')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.otpVerifyForgotPassword')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.resendOtpForgotPassword')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.otpVerifyLogin')).toBe(false);
  });

  test('gates MFA auth routes on mfaRequired', () => {
    const ids = getGeneratedApiIdentifiers(
      resolve({
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              ...upAuth.provider.config,
              mfaRequired: true,
            },
          },
        },
      }),
    );

    expect(ids.has('auth.v1.users.unknown.otpVerifyLogin')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.resendOtpLogin')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.otpVerifyRegister')).toBe(false);
  });

  test('gates verification auth routes on userModel.isVerifiedField', () => {
    const ids = getGeneratedApiIdentifiers(
      resolve({
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              ...upAuth.provider.config,
              userModel: {
                ...upAuth.provider.config.userModel,
                isVerifiedField: 'id',
              },
            },
          },
        },
      }),
    );

    expect(ids.has('auth.v1.users.unknown.otpVerifyRegister')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.resendOtpRegister')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.emailChange')).toBe(true);
    expect(ids.has('auth.v1.users.unknown.otpVerifyLogin')).toBe(false);
  });

  test('auth-model CRUD routes are enumerated even while policy-disabled', () => {
    const ids = getGeneratedApiIdentifiers(resolve({authentication: upAuth}));

    // The policy disables these by default, but the identifiers must stay
    // valid so an `apis` override can re-enable them.
    expect(ids.has('model.v1.users.email.search')).toBe(true);
    expect(ids.has('model.v1.users.id.index')).toBe(true);
  });

  test('tolerates sparse input shapes', () => {
    const ids = getGeneratedApiIdentifiers({
      application: {name: 'sparse', logLevel: 'info'},
      data: {
        models: {
          users: {
            fields: {id: {type: 'integer', primaryKey: true}},
          },
        },
      },
    } as unknown as AppConfig);

    expect(ids.has('model.v1.users.unknown.insert')).toBe(true);
    expect(ids.has('model.v1.users.id.index')).toBe(true);
  });
});

describe('isGeneratedApiIdentifier', () => {
  test('accepts generated and rejects unknown identifiers', () => {
    const config = resolve();

    expect(
      isGeneratedApiIdentifier(config, 'model.v1.users.unknown.insert'),
    ).toBe(true);
    expect(isGeneratedApiIdentifier(config, 'model.v1.users.id.delete')).toBe(
      false,
    );
    expect(
      isGeneratedApiIdentifier(config, 'model.v1.nonexistent.id.index'),
    ).toBe(false);
  });
});
