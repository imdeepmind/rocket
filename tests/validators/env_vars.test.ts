import {LogLevel} from 'fastify';
import {describe, expect, it} from 'vitest';

import {AppConfig, DatabaseConfig, ModelConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import {resolveEnvVars} from '@/utils/config';

const getDefaultDatabaseConfig = (): DatabaseConfig => {
  return {
    engine: 'sqlite',
    connection: {
      url: './test.db',
    },
  };
};

const getDefaultModelConfig = (): Record<string, ModelConfig> => {
  return {
    users: {
      table: 'users',
      fields: {
        id: {type: 'integer', primaryKey: true, unique: true, nullable: false},
      },
    },
  };
};

const validBaseConfig: AppConfig = {
  application: {
    name: 'Test App',
    logLevel: 'info',
  },
  docs: {
    openapi: {
      enabled: true,
      path: '/api',
      info: {
        title: 'Test API',
        description: 'Test API description for testing',
        version: '1.0.0',
      },
    },
  },
  infrastructure: {primaryDatabase: getDefaultDatabaseConfig()},
  data: {models: getDefaultModelConfig()},
};

describe('Config Environment Variable Resolution', () => {
  it('should resolve environment variables in config', () => {
    process.env.DB_PATH = './env-resolved.db';
    process.env.LOG_LEVEL = 'debug';

    const config: AppConfig = {
      ...validBaseConfig,
      application: {
        ...validBaseConfig.application,
        logLevel: 'env:LOG_LEVEL' as unknown as LogLevel,
      },
      infrastructure: {
        primaryDatabase: {
          ...validBaseConfig.infrastructure.primaryDatabase,
          connection: {
            url: 'env:DB_PATH',
          },
        },
      },
    };

    // Before this works, we need to ensure validateConfig handles it or startServer handles it.
    // Since startServer is harder to unit test without mocking fastify, we'll test resolveEnvVars or validateConfig.

    // If we want validateConfig to be the one responsible:
    const resolved = resolveEnvVars(config);
    const validated = validateConfig(resolved);

    expect(validated.application.logLevel).toBe('debug');
    expect(validated.infrastructure.primaryDatabase.connection.url).toBe(
      './env-resolved.db',
    );
  });

  it('should throw if environment variable is not set', () => {
    delete process.env.NON_EXISTENT_VAR;

    const config: AppConfig = {
      ...validBaseConfig,
      infrastructure: {
        primaryDatabase: {
          ...validBaseConfig.infrastructure.primaryDatabase,
          connection: {
            url: 'env:NON_EXISTENT_VAR',
          },
        },
      },
    };

    expect(() => resolveEnvVars(config)).toThrow(
      'environment variable "NON_EXISTENT_VAR"',
    );
  });
});
