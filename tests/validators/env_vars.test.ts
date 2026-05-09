import {LogLevel} from 'fastify';
import {describe, expect, it} from 'vitest';

import {AppConfig, DatabaseConfig, ModelConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import {resolveEnvVars} from '@/utils/config';

const getDefaultDatabaseConfig = (): DatabaseConfig => {
  return {
    engine: 'sqlite',
    connection: {
      urlOrPath: './test.db',
    },
  };
};

const getDefaultModelConfig = (): ModelConfig[] => {
  return [
    {
      name: 'users',
      fields: [
        {
          name: 'id',
          type: 'integer',
          primaryKey: true,
          unique: true,
          nullable: false,
        },
      ],
    },
  ];
};

const validBaseConfig: AppConfig = {
  application: {
    logLevel: 'info',
  },
  swagger: {
    enabled: true,
    basePath: '/api',
    info: {
      title: 'Test API',
      description: 'Test API description for testing',
      version: '1.0.0',
    },
  },
  database: getDefaultDatabaseConfig(),
  models: getDefaultModelConfig(),
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
      database: {
        ...validBaseConfig.database,
        connection: {
          urlOrPath: 'env:DB_PATH',
        },
      },
    };

    // Before this works, we need to ensure validateConfig handles it or startServer handles it.
    // Since startServer is harder to unit test without mocking fastify, we'll test resolveEnvVars or validateConfig.

    // If we want validateConfig to be the one responsible:
    const resolved = resolveEnvVars(config);
    const validated = validateConfig(resolved);

    expect(validated.application.logLevel).toBe('debug');
    expect(validated.database.connection.urlOrPath).toBe('./env-resolved.db');
  });

  it('should leave env:VAR if environment variable is not set', () => {
    delete process.env.NON_EXISTENT_VAR;

    const config: AppConfig = {
      ...validBaseConfig,
      database: {
        ...validBaseConfig.database,
        connection: {
          urlOrPath: 'env:NON_EXISTENT_VAR',
        },
      },
    };

    const resolved = resolveEnvVars(config);
    // This should probably fail validation if the value is required and invalid
    // But for resolution, it stays as is.
    expect(() => validateConfig(resolved)).toThrow();
  });
});
