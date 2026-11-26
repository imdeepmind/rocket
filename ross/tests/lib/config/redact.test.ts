import {describe, expect, test} from 'vitest';

import {redactConfig, redactConnectionUrl} from '@/lib/config/redact';
import {resolveConfig} from '@/lib/config/resolve';

import {AppConfigInput} from '@/interfaces/config';

const upAuth = {
  enabled: true as const,
  jwtSecret: 'super-secret-jwt-signing-key-value',
  userModel: {
    modelName: 'users',
    idField: 'id',
    providerField: 'provider',
  },
  providers: [
    {
      type: 'up-auth' as const,
      config: {
        fields: {
          emailField: 'email',
          passwordField: 'password',
          isVerifiedField: 'is_active',
        },
      },
    },
    {
      type: 'sso' as const,
      name: 'google',
      protocol: 'oidc' as const,
      config: {
        fields: {providerIdField: 'provider_id'},
        issuerUrl: 'https://accounts.google.com',
        clientId: 'client-id',
        clientSecret: 'super-secret-client-value',
      },
    },
    {
      type: 'sso' as const,
      name: 'corp',
      protocol: 'saml' as const,
      config: {
        fields: {providerIdField: 'provider_id'},
        entryPoint: 'https://idp.example.com/saml',
        issuer: 'ross',
        cert: 'super-secret-certificate',
      },
    },
  ],
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
  test('redacts jwtSecret and client secrets', () => {
    const config = buildConfig({authentication: upAuth});
    const redacted = redactConfig(config);

    expect(redacted.authentication).toEqual(
      expect.objectContaining({
        enabled: true,
        jwtSecret: '***',
      }),
    );

    const providers = (
      redacted.authentication as {
        providers: Array<{config: {clientSecret?: string; cert?: string}}>;
      }
    ).providers;

    expect(providers[1].config.clientSecret).toBe('***');
    expect(providers[2].config.cert).toBe('***');
  });

  test('redacts api-key secrets', () => {
    const config = buildConfig({
      authentication: {
        enabled: true,
        providers: [{type: 'api-key', config: {key: 'live-key-1234'}}],
      },
    });

    const redacted = redactConfig(config);

    expect(
      (redacted.authentication as {providers: Array<{config: {key: string}}>})
        .providers[0].config.key,
    ).toBe('***');
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

  test('redacts memcached connection credentials', () => {
    const config = buildConfig({
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://dbuser:dbpass@db.host:5432/rocket'},
        },
        cache: {
          engine: 'memcached',
          connection: {
            url: 'memcached://memuser:mempass@cache.host:11211',
          },
        },
      },
    });

    const redacted = redactConfig(config);

    if (redacted.infrastructure.cache.engine === 'memcached') {
      expect(redacted.infrastructure.cache.connection.url).toBe(
        'memcached://***:***@cache.host:11211',
      );
    }
  });

  test('redacts aws-ses secretAccessKey but keeps accessKeyId', () => {
    const config = buildConfig({
      integrations: {
        email: {
          provider: 'aws-ses',
          config: {
            region: 'us-east-1',
            fromEmail: 'noreply@example.com',
            accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
            secretAccessKey: 'super-secret-key',
          },
        },
      },
    });

    const redacted = redactConfig(config);

    expect(redacted.integrations.email).toEqual({
      provider: 'aws-ses',
      config: {
        region: 'us-east-1',
        fromEmail: 'noreply@example.com',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: '***',
      },
    });
  });

  test('leaves aws-ses config without credentials untouched', () => {
    const config = buildConfig({
      integrations: {
        email: {
          provider: 'aws-ses',
          config: {
            region: 'eu-west-1',
            fromEmail: 'noreply@example.com',
          },
        },
      },
    });

    const redacted = redactConfig(config);

    expect(redacted.integrations.email).toEqual({
      provider: 'aws-ses',
      config: {
        region: 'eu-west-1',
        fromEmail: 'noreply@example.com',
      },
    });
  });

  test('leaves the dummy email provider untouched', () => {
    const config = buildConfig({
      integrations: {email: {provider: 'dummy'}},
    });

    const redacted = redactConfig(config);

    expect(redacted.integrations.email).toEqual({provider: 'dummy'});
  });

  test('redacts the sendgrid apiKey but keeps fromEmail', () => {
    const config = buildConfig({
      integrations: {
        email: {
          provider: 'sendgrid',
          config: {
            apiKey: 'SG.super-secret-api-key',
            fromEmail: 'noreply@example.com',
          },
        },
      },
    });

    const redacted = redactConfig(config);

    expect(redacted.integrations.email).toEqual({
      provider: 'sendgrid',
      config: {
        apiKey: '***',
        fromEmail: 'noreply@example.com',
      },
    });
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
