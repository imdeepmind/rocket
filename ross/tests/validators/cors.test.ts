import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {resolveEnvVars} from '@/lib/config/env';
import {DEFAULT_CORS, resolveApplication} from '@/lib/config/resolve';

import {AppConfig, ModelConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import validateCorsConstraints from '@/validators/config/validate-cors';

describe('CORS configuration and validation', () => {
  const baseConfig: AppConfig = {
    application: {
      name: 'Test App',
      logLevel: 'info',
    },
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {
          title: 'Test Application',
          description: 'Test Application Description',
          version: '1.0.0',
        },
      },
    },
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {url: './test.db'},
      },
    },
    data: {
      models: {
        users: {
          fields: {
            id: {type: 'integer', primaryKey: true},
          },
        } as ModelConfig,
      },
    },
  };

  it('should default cors to enabled: false when omitted', () => {
    const resolved = resolveApplication(baseConfig.application);
    expect(resolved.cors).toEqual({
      enabled: false,
      origins: DEFAULT_CORS.origins,
      methods: DEFAULT_CORS.methods,
      allowedHeaders: DEFAULT_CORS.allowedHeaders,
      exposedHeaders: DEFAULT_CORS.exposedHeaders,
      credentials: false,
      maxAge: 86400,
      routes: DEFAULT_CORS.routes,
    });
  });

  it('should resolve cors options when provided', () => {
    const resolved = resolveApplication({
      ...baseConfig.application,
      cors: {
        enabled: true,
        origins: ['https://app.example.com'],
        methods: ['GET', 'POST'],
        credentials: true,
        maxAge: 3600,
        routes: ['/api/*'],
      },
    });

    expect(resolved.cors).toEqual({
      enabled: true,
      origins: ['https://app.example.com'],
      methods: ['GET', 'POST'],
      allowedHeaders: DEFAULT_CORS.allowedHeaders,
      exposedHeaders: [],
      credentials: true,
      maxAge: 3600,
      routes: ['/api/*'],
    });
  });

  it('should pass validation for valid cors config', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          origins: ['https://app.example.com', 'http://localhost:5173'],
          methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
          allowedHeaders: ['Authorization', 'Content-Type'],
          exposedHeaders: ['x-ratelimit-limit'],
          credentials: false,
          maxAge: 86400,
          routes: ['/api/*'],
        },
      },
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should reject origins: ["*"] combined with credentials: true', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          origins: ['*'],
          credentials: true,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(
      'application.cors: credentials cannot be true when origins includes "*"',
    );

    const errors = validateCorsConstraints(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      'credentials cannot be true when origins includes "*"',
    );
  });

  it('should allow origins: ["*"] when credentials is false', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          origins: ['*'],
          credentials: false,
        },
      },
    };

    expect(() => validateConfig(config)).not.toThrow();
    const errors = validateCorsConstraints(config);
    expect(errors).toHaveLength(0);
  });

  it('should reject unrecognized properties under application.cors', () => {
    const config = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          invalidProperty: true,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must NOT have additional properties',
    );
  });

  it('should reject invalid methods under application.cors', () => {
    const config = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          methods: ['INVALID_METHOD'],
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must be equal to one of the allowed values',
    );
  });

  it('should reject negative maxAge under application.cors', () => {
    const config = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        cors: {
          enabled: true,
          maxAge: -1,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must be >= 0',
    );
  });

  describe('env variable resolution in origins', () => {
    const originalEnv = process.env.FRONTEND_ORIGIN;

    beforeEach(() => {
      process.env.FRONTEND_ORIGIN = 'https://frontend.production.com';
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.FRONTEND_ORIGIN = originalEnv;
      } else {
        delete process.env.FRONTEND_ORIGIN;
      }
    });

    it('should resolve env: variables in origins array', () => {
      const input = {
        application: {
          cors: {
            enabled: true,
            origins: ['https://static.example.com', 'env:FRONTEND_ORIGIN'],
          },
        },
      };

      const resolved = resolveEnvVars(input);
      expect(resolved.application.cors.origins).toEqual([
        'https://static.example.com',
        'https://frontend.production.com',
      ]);
    });
  });
});
