import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest';

import {AppConfig} from '@/interfaces/config';

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
      name: 'Test App',
      logLevel: 'info',
    },
    docs: {
      openapi: {
        enabled: true,
        path: '/docs',
        info: {
          title: 'Rocket API',
          description: 'Test API',
          version: '1.0.0',
        },
      },
    },
    infrastructure: {
      primaryDatabase: {
        engine: 'sqlite',
        connection: {
          url: ':memory:',
        },
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

    expect(output).toContain('Test App');
    expect(output).toContain('http://0.0.0.0:3000');
    expect(output).toContain('http://0.0.0.0:3000/docs');
    expect(output).toContain('SQLITE');
    expect(output).toContain('User');
    expect(output).toContain('Post');
    expect(output).toContain('/users');
    expect(output).toContain('/mixed');

    // Check filtering — swagger paths and HEAD routes are filtered
    expect(output).not.toContain('HEAD');
    expect(output).toContain('/static/style.css');
  });

  test('showWelcomeScreen handles disabled swagger', () => {
    const disabledSwaggerConfig: AppConfig = {
      ...mockConfig,
      docs: {
        openapi: {...mockConfig.docs.openapi, enabled: false},
      },
    };

    showWelcomeScreen(disabledSwaggerConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('Swagger UI:  Disabled');
  });

  test('showWelcomeScreen handles different database engines', () => {
    const pgConfig: AppConfig = {
      ...mockConfig,
      infrastructure: {
        primaryDatabase: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost'},
        },
      },
    };

    showWelcomeScreen(pgConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('POSTGRES');
  });

  test('showWelcomeScreen handles unknown methods gracefully', () => {
    const unknownRoute: RouteInfo[] = [{method: 'UNKNOWN', url: '/unknown'}];

    showWelcomeScreen(mockConfig, 3000, unknownRoute);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('UNKNOWN');
    expect(output).toContain('/unknown');
  });

  test('showWelcomeScreen handles cache and rateLimit', () => {
    const fullConfig: AppConfig = {
      ...mockConfig,
      infrastructure: {
        ...mockConfig.infrastructure,
        cache: {
          engine: 'redis',
          connection: {url: 'redis://localhost'},
        },
      },
      application: {
        name: 'Test App',
        logLevel: 'info',
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
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
        name: 'Test App',
        logLevel: 'info',
        rateLimit: {
          enabled: false,
          max: 100,
          timeWindow: '15m',
        },
      },
    };

    showWelcomeScreen(disabledRateLimitConfig, 3000, mockRoutes);

    const calls = consoleSpy.mock.calls.map((call: unknown[]) => call[0]);
    const output = calls.join('\n');

    expect(output).toContain('Rate Limit:  Disabled');
  });
});
