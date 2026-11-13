import {describe, expect, it} from 'vitest';

import {AppConfig} from '@/interfaces/config';

import validateRateLimitConstraints from '@/validators/config/validate-rate-limit';

describe('validateRateLimitConstraints', () => {
  const baseConfig: AppConfig = {
    application: {
      name: 'Test App',
      logLevel: 'info',
      rateLimit: {
        enabled: true,
        max: 100,
        timeWindow: '1m',
      },
    },
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {url: ':memory:'},
      },
    },
    data: {
      models: {},
    },
  };

  it('returns no errors when rateLimitHealthAPI is not enabled', () => {
    const errors = validateRateLimitConstraints(baseConfig);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors when rateLimitHealthAPI is false', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        rateLimit: {
          ...baseConfig.application.rateLimit!,
          rateLimitHealthAPI: false,
        },
      },
    };
    const errors = validateRateLimitConstraints(config);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors when rateLimit and healthCheck are both enabled with rateLimitHealthAPI true', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '1m',
          rateLimitHealthAPI: true,
        },
        healthCheck: {
          enabled: true,
        },
      },
    };
    const errors = validateRateLimitConstraints(config);
    expect(errors).toHaveLength(0);
  });

  it('returns error when rateLimitHealthAPI is true but rateLimit is disabled', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        rateLimit: {
          enabled: false,
          max: 100,
          timeWindow: '1m',
          rateLimitHealthAPI: true,
        },
      },
    };
    const errors = validateRateLimitConstraints(config);
    expect(errors).toContain(
      'application.rateLimit: rateLimitHealthAPI can only be enabled when rateLimit is enabled',
    );
  });

  it('returns error when rateLimitHealthAPI is true but healthCheck is disabled', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '1m',
          rateLimitHealthAPI: true,
        },
        healthCheck: {
          enabled: false,
        },
      },
    };
    const errors = validateRateLimitConstraints(config);
    expect(errors).toContain(
      'application.rateLimit: rateLimitHealthAPI can only be enabled when healthCheck is enabled',
    );
  });

  it('returns both errors when rateLimitHealthAPI is true but both rateLimit and healthCheck are disabled', () => {
    const config: AppConfig = {
      ...baseConfig,
      application: {
        ...baseConfig.application,
        rateLimit: {
          enabled: false,
          max: 100,
          timeWindow: '1m',
          rateLimitHealthAPI: true,
        },
        healthCheck: {
          enabled: false,
        },
      },
    };
    const errors = validateRateLimitConstraints(config);
    expect(errors).toHaveLength(2);
    expect(errors).toContain(
      'application.rateLimit: rateLimitHealthAPI can only be enabled when rateLimit is enabled',
    );
    expect(errors).toContain(
      'application.rateLimit: rateLimitHealthAPI can only be enabled when healthCheck is enabled',
    );
  });

  it('returns no errors when application or rateLimit is omitted', () => {
    const config = {
      ...baseConfig,
      application: {
        name: 'Test App',
        logLevel: 'info',
      },
    } as AppConfig;
    const errors = validateRateLimitConstraints(config);
    expect(errors).toHaveLength(0);
  });
});
