import {describe, expect, test} from 'vitest';

import {getApiRouteTargets, resolveApiPolicy} from '@/lib/config/api';
import {resolveConfig} from '@/lib/config/resolve';

import {
  ApiVariantEntry,
  AppConfigInput,
  ResolvedAppConfig,
} from '@/interfaces/config';

const upAuthAuthentication = {
  enabled: true as const,
  provider: {
    type: 'up-auth' as const,
    config: {
      userModel: {
        model: 'users',
        idField: 'id',
        usernameField: 'email',
        passwordField: 'password',
      },
      jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
    },
  },
};

const baseInput = (
  apis: AppConfigInput['apis'] = {},
  apiVariants: Record<string, ApiVariantEntry> = {},
): AppConfigInput => ({
  application: {name: 'Test App'},
  data: {
    models: {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          email: {type: 'string', apis: ['search'], aggregations: ['count']},
        },
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          title: {type: 'string', apis: ['search']},
        },
      },
    },
  },
  authentication: upAuthAuthentication,
  apis,
  apiVariants,
});

const resolve = (
  apis: AppConfigInput['apis'] = {},
  apiVariants: Record<string, ApiVariantEntry> = {},
): ResolvedAppConfig =>
  resolveConfig(baseInput(apis, apiVariants), {mode: 'dev'});

describe('resolveApiPolicy', () => {
  test('derives defaults for a plain model API', () => {
    const policy = resolveApiPolicy(resolve(), 'model.v1.posts.title.search');

    expect(policy).toEqual({
      enabled: true,
      tags: ['Posts', 'Read'],
      authorization: true,
      bypassSecret: false,
      webhooks: [],
      serverSideParams: [],
      supportedQueries: undefined,
      supportedAggregations: undefined,
    });
  });

  test('authorization falls back to the global authentication flag', () => {
    const config = resolveConfig(
      {...baseInput(), authentication: {enabled: false}},
      {mode: 'dev'},
    );

    expect(
      resolveApiPolicy(config, 'model.v1.posts.title.search').authorization,
    ).toBe(false);
  });

  test('explicit override values win over derived defaults', () => {
    const config = resolve({
      'model.v1.posts.title.search': {
        enabled: true,
        tags: ['Custom'],
        authorization: false,
        bypassSecret: true,
        webhooks: [
          {
            url: 'https://example.com',
            data: ['query'],
            triggerOnRequest: true,
            triggerOnResponse: false,
          },
        ],
        serverSideParams: [{type: 'query', name: 'org', value: 'acme'}],
        supportedQueries: ['eq'],
        supportedAggregations: ['count'],
      },
    });

    const policy = resolveApiPolicy(config, 'model.v1.posts.title.search');

    expect(policy.tags).toEqual(['Custom']);
    expect(policy.authorization).toBe(false);
    expect(policy.bypassSecret).toBe(true);
    expect(policy.webhooks).toHaveLength(1);
    expect(policy.serverSideParams).toHaveLength(1);
    expect(policy.supportedQueries).toEqual(['eq']);
    expect(policy.supportedAggregations).toEqual(['count']);
  });

  test('explicit enabled:false disables the API', () => {
    const config = resolve({'model.v1.posts.title.search': {enabled: false}});

    expect(
      resolveApiPolicy(config, 'model.v1.posts.title.search').enabled,
    ).toBe(false);
  });

  test('CRUD APIs of the auth user model are disabled by default', () => {
    const config = resolve();

    expect(
      resolveApiPolicy(config, 'model.v1.users.email.search').enabled,
    ).toBe(false);
  });

  test('explicit enabled:true re-enables auth-model CRUD APIs', () => {
    const config = resolve({'model.v1.users.email.search': {enabled: true}});

    expect(
      resolveApiPolicy(config, 'model.v1.users.email.search').enabled,
    ).toBe(true);
  });

  test('non-CRUD modules stay enabled for the auth user model', () => {
    const config = resolve();

    expect(
      resolveApiPolicy(config, 'auth.v1.users.unknown.login').enabled,
    ).toBe(true);
    expect(
      resolveApiPolicy(config, 'aggregate.v1.users.email.getAggregation')
        .enabled,
    ).toBe(true);
  });

  test('variant inherits scalar fields from the base override', () => {
    const config = resolve({
      'model.v1.posts.title.search': {
        tags: ['Base Tag'],
        authorization: false,
        bypassSecret: true,
        enabled: true,
      },
    });

    const policy = resolveApiPolicy(config, 'model.admin.posts.title.search');

    expect(policy.enabled).toBe(true);
    expect(policy.tags).toEqual(['Base Tag']);
    expect(policy.authorization).toBe(false);
    expect(policy.bypassSecret).toBe(true);
  });

  test('variant explicit scalar values override the base', () => {
    const config = resolve({
      'model.v1.posts.title.search': {tags: ['Base Tag'], enabled: true},
      'model.admin.posts.title.search': {tags: ['Admin Tag'], enabled: false},
    });

    const policy = resolveApiPolicy(config, 'model.admin.posts.title.search');

    expect(policy.tags).toEqual(['Admin Tag']);
    expect(policy.enabled).toBe(false);
  });

  test('list fields never inherit from the base override', () => {
    const config = resolve({
      'model.v1.posts.title.search': {
        webhooks: [
          {
            url: 'https://example.com',
            data: ['query'],
            triggerOnRequest: true,
            triggerOnResponse: false,
          },
        ],
        serverSideParams: [{type: 'query', name: 'org', value: 'acme'}],
        supportedQueries: ['eq'],
        supportedAggregations: ['count'],
        enabled: true,
      },
    });

    const policy = resolveApiPolicy(config, 'model.admin.posts.title.search');

    expect(policy.webhooks).toEqual([]);
    expect(policy.serverSideParams).toEqual([]);
    expect(policy.supportedQueries).toBeUndefined();
    expect(policy.supportedAggregations).toBeUndefined();
  });

  test('derives auth tags per operation', () => {
    const config = resolve();

    expect(
      resolveApiPolicy(config, 'auth.v1.users.unknown.login').tags,
    ).toEqual(['Users', 'Auth', 'Login']);
    expect(
      resolveApiPolicy(config, 'auth.v1.users.unknown.otpVerifyLogin').tags,
    ).toEqual(['Users', 'Auth', 'OTP']);
    expect(resolveApiPolicy(config, 'auth.v1.users.unknown.me').tags).toEqual([
      'Users',
      'Auth',
      'Profile',
    ]);
  });

  test('malformed identifiers fall back to global defaults', () => {
    const policy = resolveApiPolicy(resolve(), 'not-an-identifier');

    expect(policy.enabled).toBe(true);
    expect(policy.tags).toEqual([]);
  });
});

describe('getApiRouteTargets', () => {
  test('returns only the default variant when no variants are configured', () => {
    const targets = getApiRouteTargets(
      resolve(),
      'model',
      'posts',
      'title',
      'search',
    );

    expect(targets.map(t => t.variant)).toEqual(['v1']);
    expect(targets[0].identifier).toBe('model.v1.posts.title.search');
  });

  test('returns default + configured variants in order', () => {
    const config = resolve(
      {},
      {
        'model.v1.posts.title.search': {variants: ['admin', 'beta']},
      },
    );

    const targets = getApiRouteTargets(
      config,
      'model',
      'posts',
      'title',
      'search',
    );

    expect(targets.map(t => t.variant)).toEqual(['v1', 'admin', 'beta']);
  });

  test('deduplicates a configured variant equal to the default', () => {
    const config = resolve(
      {},
      {
        'model.v1.posts.title.search': {variants: ['v1', 'admin']},
      },
    );

    const targets = getApiRouteTargets(
      config,
      'model',
      'posts',
      'title',
      'search',
    );

    expect(targets.map(t => t.variant)).toEqual(['v1', 'admin']);
  });

  test('omits disabled variants', () => {
    const config = resolve(
      {'model.admin.posts.title.search': {enabled: false}},
      {'model.v1.posts.title.search': {variants: ['admin']}},
    );

    const targets = getApiRouteTargets(
      config,
      'model',
      'posts',
      'title',
      'search',
    );

    expect(targets.map(t => t.variant)).toEqual(['v1']);
  });

  test('auth-model variants obey the auth-model enablement rule', () => {
    // Regression: variants used to bypass the "auth model CRUD is off" rule.
    const config = resolve(
      {},
      {
        'model.v1.users.email.search': {variants: ['admin']},
      },
    );

    expect(
      getApiRouteTargets(config, 'model', 'users', 'email', 'search'),
    ).toEqual([]);
  });

  test('auth-model variants are registered when explicitly enabled', () => {
    const config = resolve(
      {
        'model.v1.users.email.search': {enabled: true},
        'model.admin.users.email.search': {enabled: true},
      },
      {'model.v1.users.email.search': {variants: ['admin']}},
    );

    const targets = getApiRouteTargets(
      config,
      'model',
      'users',
      'email',
      'search',
    );

    expect(targets.map(t => t.variant)).toEqual(['v1', 'admin']);
  });

  test('each target carries its resolved policy', () => {
    const config = resolve(
      {'model.admin.posts.title.search': {tags: ['Admin']}},
      {'model.v1.posts.title.search': {variants: ['admin']}},
    );

    const targets = getApiRouteTargets(
      config,
      'model',
      'posts',
      'title',
      'search',
    );

    expect(targets[0].policy.tags).toEqual(['Posts', 'Read']);
    expect(targets[1].policy.tags).toEqual(['Admin']);
  });
});
