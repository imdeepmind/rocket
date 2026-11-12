import {handleDev} from '@/cli/commands/dev';
import * as configFinder from '@/cli/config-finder';
import {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {startServer} from '@/server';

import {showWelcomeScreen} from '@/lib/server/welcome';

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

describe('cli/commands/dev', () => {
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

  it('starts server with development defaults and registers welcome screen', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleDev({});

    expect(process.env.NODE_ENV).toBe('development');
    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith(undefined);
    expect(configFinder.loadConfigFile).toHaveBeenCalledWith('/app/ross.json');
    expect(startServer).toHaveBeenCalledWith(
      {application: {name: 'Dev App'}},
      3000,
      'dev',
      false,
      false,
    );
    expect(mockApp.listen).toHaveBeenCalledWith({
      port: 3000,
      host: '0.0.0.0',
    });
    expect(showWelcomeScreen).toHaveBeenCalledWith(
      {application: {name: 'Dev App'}},
      3000,
      [],
    );
  });

  it('respects custom port, host, migrate, and verbose flags', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
      '/app/custom.json',
    );
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleDev({
      config: 'custom.json',
      port: 8080,
      host: '127.0.0.1',
      migrate: true,
      verbose: true,
    });

    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith('custom.json');
    expect(startServer).toHaveBeenCalledWith(
      {application: {name: 'Dev App'}},
      8080,
      'dev',
      true,
      true,
    );
    expect(mockApp.listen).toHaveBeenCalledWith({
      port: 8080,
      host: '127.0.0.1',
    });
  });

  it('uses PORT environment variable when port option is omitted', async () => {
    process.env.PORT = '5000';
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleDev({});

    expect(mockApp.listen).toHaveBeenCalledWith({
      port: 5000,
      host: '0.0.0.0',
    });
  });

  it('exits with 1 when app.listen fails', async () => {
    const mockApp = {
      listen: vi.fn().mockRejectedValue(new Error('Address in use')),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
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

    await handleDev({});

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('closes app on SIGINT and SIGTERM', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    const handlers: Record<string | symbol, (...args: unknown[]) => void> = {};
    const onSpy = vi
      .spyOn(process, 'on')
      .mockImplementation(
        (sig: string | symbol, cb: (...args: unknown[]) => void) => {
          handlers[sig] = cb;
          return process;
        },
      );
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    await handleDev({});

    if (handlers['SIGINT']) {
      await handlers['SIGINT']();
    }
    expect(mockApp.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    if (handlers['SIGTERM']) {
      await handlers['SIGTERM']();
    }
    expect(mockApp.close).toHaveBeenCalledTimes(2);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
