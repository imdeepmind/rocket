import {
  expect,
  test,
  describe,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import {showWelcomeScreen, RouteInfo} from '@/utils/welcome';
import {AppConfig} from '@/schema/config';

describe('welcome utility', () => {
  let consoleSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockConfig: AppConfig = {
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
});
