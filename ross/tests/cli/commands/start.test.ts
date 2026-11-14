import {handleStart} from '@/cli/commands/start';
import * as configFinder from '@/cli/config-finder';
import {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {showWelcomeScreen} from '@/lib/server/welcome';

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn((cfg: unknown) => cfg),
}));

vi.mock('@/server', () => ({
  startServer: vi.fn(),
}));

vi.mock('@/lib/server/welcome', () => ({
  showWelcomeScreen: vi.fn(),
}));

vi.mock('@/cli/config-finder', () => ({
  resolveConfigPath: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn(s => s),
    yellow: vi.fn(s => s),
    green: vi.fn(s => s),
    red: vi.fn(s => s),
  },
}));

describe('cli/commands/start', () => {
  const originalPortEnv = process.env.PORT;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PORT;
  });

  afterEach(() => {
    if (originalPortEnv !== undefined) {
      process.env.PORT = originalPortEnv;
    } else {
      delete process.env.PORT;
    }
  });

  it('starts production server with prod mode and migrate=false', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Prod App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
      '/app/config.json',
    );
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Prod App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleStart({});

    expect(process.env.NODE_ENV).toBe('prod');
    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith(undefined);
    expect(configFinder.loadConfigFile).toHaveBeenCalledWith(
      '/app/config.json',
    );
    expect(resolveAndValidateConfig).toHaveBeenCalledWith(
      {application: {name: 'Prod App'}},
      'prod',
      '/app',
      {},
    );
    expect(startServer).toHaveBeenCalledWith({
      application: {name: 'Prod App'},
    });
    expect(mockApp.listen).toHaveBeenCalledWith({
      port: 3000,
      host: '0.0.0.0',
    });
    expect(showWelcomeScreen).toHaveBeenCalledWith(
      {application: {name: 'Prod App'}},
      3000,
      [],
    );
  });

  it('respects custom port, host, and verbose flags in production', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Prod App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/prod.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Prod App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleStart({
      config: 'prod.json',
      port: 80,
      host: '0.0.0.0',
      verbose: true,
    });

    expect(startServer).toHaveBeenCalledWith({
      application: {name: 'Prod App'},
    });
  });

  it('uses PORT environment variable when port option is omitted', async () => {
    process.env.PORT = '8080';
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Prod App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
      '/app/config.json',
    );
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Prod App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleStart({});

    expect(mockApp.listen).toHaveBeenCalledWith({
      port: 8080,
      host: '0.0.0.0',
    });
  });

  it('exits with 1 when app.listen fails in production', async () => {
    const mockApp = {
      listen: vi.fn().mockRejectedValue(new Error('Permission denied')),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Prod App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
      '/app/config.json',
    );
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Prod App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    await handleStart({});

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
