import {describe, expect, test} from 'vitest';

import {redactConfig, redactConnectionUrl} from '@/lib/config/redact';
import {resolveConfig} from '@/lib/config/resolve';

import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

const upAuth = {
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
      jwtSecret: 'super-secret-jwt-signing-key-value',
    },
  },
};

const buildConfig = (overrides: Partial<AppConfigInput> = {}) =>
  resolveConfig(
    {
      application: {name: 'Redact Test'},
      data: {
        models: {
          users: {
            fields: {id: {type: 'integer', primaryKey: true}},
          },
        },
      },
      ...overrides,
    },
    {mode: 'dev'},
  );

describe('redactConnectionUrl', () => {
  test.each([
    [
      'postgresql://user:pass@localhost:5432/db',
      'postgresql://***:***@localhost:5432/db',
    ],
    ['postgres://user@srv/db', 'postgres://***@srv/db'],
    ['redis://:secret@cache:6379', 'redis://***:***@cache:6379'],
    [
      'redis://default:token@cache.upstash.io:6379',
      'redis://***:***@cache.upstash.io:6379',
    ],
    // No credentials — unchanged
    ['redis://localhost:6379', 'redis://localhost:6379'],
    ['postgresql://localhost:5432/db', 'postgresql://localhost:5432/db'],
    ['./database.db', './database.db'],
    [':memory:', ':memory:'],
  ])('%s → %s', (input, expected) => {
    expect(redactConnectionUrl(input)).toBe(expected);
  });
});

describe('redactConfig', () => {
  test('redacts up-auth jwtSecret', () => {
    const config = buildConfig({authentication: upAuth});
    const redacted = redactConfig(config);

    expect(redacted.authentication).toEqual({
      enabled: true,
      provider: {
        type: 'up-auth',
        config: expect.objectContaining({jwtSecret: '***'}),
      },
    });
  });

  test('redacts api-key secrets', () => {
    const config = buildConfig({
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'live-key-1234'}},
      },
    });

    const redacted = redactConfig(config) as ResolvedAppConfig & {
      authentication: {provider: {config: {key: string}}};
    };

    expect(redacted.authentication.provider.config.key).toBe('***');
  });

  test('leaves disabled authentication untouched', () => {
    const redacted = redactConfig(buildConfig());

    expect(redacted.authentication).toEqual({enabled: false});
  });

  test('redacts database and redis connection credentials', () => {
    const config = buildConfig({
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://dbuser:dbpass@db.host:5432/rocket'},
        },
        cache: {
          engine: 'redis',
          connection: {url: 'redis://:redispass@cache.host:6379'},
        },
      },
    });

    const redacted = redactConfig(config);

    expect(redacted.infrastructure.database.connection.url).toBe(
      'postgresql://***:***@db.host:5432/rocket',
    );
    if (redacted.infrastructure.cache.engine === 'redis') {
      expect(redacted.infrastructure.cache.connection.url).toBe(
        'redis://***:***@cache.host:6379',
      );
    }
  });

  test('does not mutate the original config', () => {
    const config = buildConfig({
      authentication: upAuth,
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://user:pass@host:5432/db'},
        },
      },
    });
    const before = structuredClone(config);

    redactConfig(config);

    expect(config).toEqual(before);
  });
});
