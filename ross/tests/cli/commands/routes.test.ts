import {handleRoutes} from '@/cli/commands/routes';
import * as configFinder from '@/cli/config-finder';
import {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn((cfg: unknown) => cfg),
}));

vi.mock('@/server', () => ({
  startServer: vi.fn(),
}));

vi.mock('@/cli/config-finder', () => ({
  resolveConfigPath: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn(s => s),
    yellow: vi.fn(s => s),
    blue: vi.fn(s => s),
    blueBright: vi.fn(s => s),
    red: vi.fn(s => s),
    magenta: vi.fn(s => s),
    cyan: vi.fn(s => s),
    white: vi.fn(s => s),
    gray: vi.fn(s => s),
    bold: vi.fn(s => s),
  },
}));

describe('cli/commands/routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects routes, closes app, and prints sorted table', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);

    const mockApp = {
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;

    const mockRoutes = [
      {
        method: 'POST',
        url: '/api/v1/notes',
        apiIdentifier: 'notes:v1:notes:*:post',
      },
      {
        method: 'GET',
        url: '/api/v1/notes',
        apiIdentifier: 'notes:v1:notes:*:get_all',
      },
      {
        method: 'HEAD',
        url: '/api/v1/notes',
      },
      {
        method: 'GET/POST',
        url: '/api/v1/multi',
      },
      {
        method: 'UNKNOWN',
        url: '/api/v1/other',
      },
    ];

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: mockRoutes,
    });

    await handleRoutes({mode: 'prod'});

    expect(resolveAndValidateConfig).toHaveBeenCalledWith({}, 'prod', '/app', {
      mode: 'prod',
    });
    expect(startServer).toHaveBeenCalledWith({});
    expect(mockApp.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    const loggedLines = logSpy.mock.calls.map(c => String(c[0]));
    // Should filter out HEAD (4 routes remaining)
    expect(
      loggedLines.some(l => l.includes('Registered Routes (4 endpoints)')),
    ).toBe(true);
    // Should include GET /api/v1/notes
    expect(loggedLines.some(l => l.includes('/api/v1/notes'))).toBe(true);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when an error occurs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockImplementation(() => {
      throw new Error('Config file not found');
    });

    await handleRoutes({});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      'Config file not found',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('handles non-Error thrown gracefully and exits with 1', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockImplementation(() => {
      throw 'string error';
    });

    await handleRoutes({});

    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 'string error');
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
