import {LogLevel} from 'fastify';
import {describe, expect, it} from 'vitest';

import {resolveEnvVars} from '@/lib/config/env';

import {AppConfig, DatabaseConfig, ModelConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';

describe('resolveEnvVars', () => {
  it('should resolve environment variables in a string', () => {
    process.env.TEST_VAR = 'resolved_value';
    expect(resolveEnvVars('env:TEST_VAR')).toBe('resolved_value');
  });

  it('should throw if env var is not found', () => {
    expect(() => resolveEnvVars('env:NON_EXISTENT')).toThrow(
      'environment variable "NON_EXISTENT"',
    );
  });

  it('should throw if env var name is empty', () => {
    expect(() => resolveEnvVars('env:')).toThrow(
      'has an empty environment variable name',
    );
  });

  it('should not change string if it does not start with env:', () => {
    expect(resolveEnvVars('normal_string')).toBe('normal_string');
  });

  it('should recursively resolve environment variables in an object', () => {
    process.env.VAR1 = 'val1';
    process.env.VAR2 = 'val2';
    const config = {
      a: 'env:VAR1',
      b: {
        c: 'env:VAR2',
        d: 'plain',
      },
      e: ['env:VAR1', 'plain'],
    };
    const expected = {
      a: 'val1',
      b: {
        c: 'val2',
        d: 'plain',
      },
      e: ['val1', 'plain'],
    };
    expect(resolveEnvVars(config)).toEqual(expected);
  });

  it('should handle null and non-object types', () => {
    expect(resolveEnvVars(null)).toBe(null);
    expect(resolveEnvVars(123)).toBe(123);
    expect(resolveEnvVars(true)).toBe(true);
  });
});

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
  infrastructure: {database: getDefaultDatabaseConfig()},
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
        database: {
          ...validBaseConfig.infrastructure.database,
          connection: {
            url: 'env:DB_PATH',
          },
        },
      },
    };

    const resolved = resolveEnvVars(config);
    const validated = validateConfig(resolved);

    expect(validated.application.logLevel).toBe('debug');
    expect(validated.infrastructure.database.connection.url).toBe(
      './env-resolved.db',
    );
  });

  it('should throw if environment variable is not set', () => {
    delete process.env.NON_EXISTENT_VAR;

    const config: AppConfig = {
      ...validBaseConfig,
      infrastructure: {
        database: {
          ...validBaseConfig.infrastructure.database,
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
