import {afterEach, describe, expect, it, vi} from 'vitest';

import {defineConfig} from '@/lib/config/define';

import {AppConfigInput} from '@/interfaces/config';

const minimalConfig: AppConfigInput = {
  application: {name: 'Test App', logLevel: 'info'},
  infrastructure: {
    database: {engine: 'sqlite', connection: {url: './test.db'}},
  },
  data: {
    models: {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true},
        },
      },
    },
  },
};

describe('defineConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should resolve defaults and normalize the configuration', () => {
    const config = defineConfig(minimalConfig);

    expect(config.application.rateLimit.enabled).toBe(false);
    expect(config.application.cors.enabled).toBe(false);
    expect(config.docs.openapi.enabled).toBe(true);
    expect(config.infrastructure.cache).toEqual({engine: 'memory'});
  });

  it('should resolve environment variables', () => {
    vi.stubEnv('ROSS_TEST_APP_NAME', 'From Env');

    const config = defineConfig({
      ...minimalConfig,
      application: {name: 'env:ROSS_TEST_APP_NAME', logLevel: 'info'},
    });

    expect(config.application.name).toBe('From Env');
  });

  it('should default to prod mode when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const config = defineConfig(minimalConfig);

    expect(config.docs.openapi.enabled).toBe(false);
  });

  it('should let an explicit mode override NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const config = defineConfig(minimalConfig, {mode: 'dev'});

    expect(config.docs.openapi.enabled).toBe(true);
  });

  it('should resolve relative paths against configDir', () => {
    const config = defineConfig(
      {
        ...minimalConfig,
        infrastructure: {
          database: {
            engine: 'sqlite',
            connection: {url: './test.db'},
            migrations: {directory: 'migrations'},
          },
        },
      },
      {configDir: '/tmp/ross-project'},
    );

    expect(config.infrastructure.database.migrations?.directory).toBe(
      '/tmp/ross-project/migrations',
    );
  });

  it('should validate the resolved configuration', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => defineConfig({})).toThrow(/infrastructure.database/);
  });
});
