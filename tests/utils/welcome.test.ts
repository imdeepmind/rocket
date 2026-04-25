import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest';

import {AppConfig} from '@/schema/config';

import {RouteInfo, showWelcomeScreen} from '@/utils/welcome';

describe('welcome utility', () => {
  let consoleSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockConfig: AppConfig = {
    application: {
      logLevel: 'info',
    },
    swagger: {
      enabled: true,
      basePath: '/docs',
      info: {
        title: 'Rocket API',
        description: 'Test API',
        version: '1.0.0',
      },
    },
    database: {
      engine: 'sqlite',
      connection: {
        urlOrPath: ':memory:',
      },
    },
    models: [
      {
        name: 'User',
        fields: [
          {name: 'id', type: 'integer', primaryKey: true},
          {name: 'name', type: 'string'},
        ],
      },
      {
        name: 'Post',
        fields: [
          {name: 'id', type: 'integer', primaryKey: true},
          {name: 'title', type: 'string'},
        ],
      },
    ],
  };

  const mockRoutes: RouteInfo[] = [
    {method: 'GET', url: '/users'},
    {method: 'POST', url: '/users'},
    {method: 'HEAD', url: '/users'},
    {method: 'GET/POST', url: '/mixed'},
    {method: 'GET', url: '/static/style.css'},
  ];

  test('showWelcomeScreen prints expected information', () => {
    showWelcomeScreen(mockConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('ROCKET API FRAMEWORK');
    expect(output).toContain('http://0.0.0.0:3000');
    expect(output).toContain('http://0.0.0.0:3000/docs');
    expect(output).toContain('SQLITE');
    expect(output).toContain('User');
    expect(output).toContain('Post');
    expect(output).toContain('/users');
    expect(output).toContain('/mixed');

    // Check filtering
    expect(output).not.toContain('/static/style.css');
    expect(output).not.toContain('HEAD');
  });

  test('showWelcomeScreen handles disabled swagger', () => {
    const disabledSwaggerConfig: AppConfig = {
      ...mockConfig,
      swagger: {...mockConfig.swagger, enabled: false},
    };

    showWelcomeScreen(disabledSwaggerConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('Swagger UI:  Disabled');
  });

  test('showWelcomeScreen handles different database engines', () => {
    const pgConfig: AppConfig = {
      ...mockConfig,
      database: {
        engine: 'pg',
        connection: {urlOrPath: 'postgresql://localhost'},
      },
    };

    showWelcomeScreen(pgConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('PG');
  });

  test('showWelcomeScreen handles unknown methods gracefully', () => {
    const unknownRoute: RouteInfo[] = [{method: 'UNKNOWN', url: '/unknown'}];

    showWelcomeScreen(mockConfig, 3000, unknownRoute);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('UNKNOWN');
    expect(output).toContain('/unknown');
  });

  test('showWelcomeScreen handles cache_db and rateLimit', () => {
    const fullConfig: AppConfig = {
      ...mockConfig,
      cache_db: {
        engine: 'redis',
        connection: {uri: 'redis://localhost'},
      },
      application: {
        logLevel: 'info',
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
          useRedis: true,
        },
      },
    };

    showWelcomeScreen(fullConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('Cache DB:    REDIS');
    expect(output).toContain('Rate Limit:  100 req / 15m');
  });

  test('showWelcomeScreen handles disabled rateLimit', () => {
    const disabledRateLimitConfig: AppConfig = {
      ...mockConfig,
      application: {
        logLevel: 'info',
        rateLimit: {
          enabled: false,
          max: 100,
          timeWindow: '15m',
          useRedis: false,
        },
      },
    };

    showWelcomeScreen(disabledRateLimitConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('Rate Limit:  Disabled');
  });
});
