import {handleRoutes} from '@/cli/commands/routes';
import * as configFinder from '@/cli/config-finder';
import {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {startServer} from '@/server';

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

    expect(startServer).toHaveBeenCalledWith({}, 0, 'prod', false, false);
    expect(mockApp.close).toHaveBeenCalledTimes(1);

    const loggedLines = logSpy.mock.calls.map(c => String(c[0]));
    // Should filter out HEAD (4 routes remaining)
    expect(
      loggedLines.some(l => l.includes('Registered Routes (4 endpoints)')),
    ).toBe(true);
    // Should include GET /api/v1/notes
    expect(loggedLines.some(l => l.includes('/api/v1/notes'))).toBe(true);

    logSpy.mockRestore();
  });
});
