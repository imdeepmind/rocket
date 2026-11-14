import {handleDev} from '@/cli/commands/dev';
import * as configFinder from '@/cli/config-finder';
import {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator';
import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {buildFunctions} from '@/lib/functions/builder';
import {showWelcomeScreen} from '@/lib/server/welcome';

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn((cfg: unknown) => cfg),
}));

vi.mock('@/lib/functions/builder', () => ({
  buildFunctions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/migrator', () => ({
  default: vi.fn().mockResolvedValue(undefined),
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
    expect(resolveAndValidateConfig).toHaveBeenCalledWith(
      {application: {name: 'Dev App'}},
      'dev',
      '/app',
      {},
    );
    expect(buildFunctions).toHaveBeenCalledWith({
      config: {application: {name: 'Dev App'}},
      configDir: '/app',
    });
    expect(startServer).toHaveBeenCalledWith({
      application: {name: 'Dev App'},
    });
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
    expect(migrateDatabase).toHaveBeenCalledWith({
      application: {name: 'Dev App'},
    });
    expect(startServer).toHaveBeenCalledWith({
      application: {name: 'Dev App'},
    });
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

  it('exits with 1 when buildFunctions fails', async () => {
    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(buildFunctions).mockRejectedValueOnce(
      new Error('TypeScript compilation error'),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    await expect(handleDev({})).rejects.toThrow('process.exit: 1');

    expect(buildFunctions).toHaveBeenCalled();
    expect(startServer).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to build functions:',
      'TypeScript compilation error',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exits with 1 when migrateDatabase fails', async () => {
    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(migrateDatabase).mockRejectedValueOnce(
      new Error('Migration syntax error'),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    await expect(handleDev({migrate: true})).rejects.toThrow('process.exit: 1');

    expect(migrateDatabase).toHaveBeenCalled();
    expect(startServer).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      'Migration syntax error',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('passes dangerouslyAllowDDL to resolveAndValidateConfig when dangerouslyAllowDdl CLI flag is passed', async () => {
    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      appConfig: {application: {name: 'Dev App'}},
    } as unknown as FastifyInstance;

    const mockResolved = {
      application: {name: 'Dev App'},
      server: {port: 3000},
      infrastructure: {
        database: {
          engine: 'postgres',
          migrations: {
            directory: 'migrations',
            dangerouslyAllowDDL: true,
          },
        },
      },
    };

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({
      application: {name: 'Dev App'},
    });
    vi.mocked(resolveAndValidateConfig).mockReturnValue(mockResolved as never);
    vi.mocked(startServer).mockResolvedValue({
      app: mockApp,
      routes: [],
    });

    await handleDev({
      migrate: true,
      dangerouslyAllowDdl: true,
    });

    expect(resolveAndValidateConfig).toHaveBeenCalledWith(
      {application: {name: 'Dev App'}},
      'dev',
      '/app',
      {migrate: true, dangerouslyAllowDdl: true},
    );
    expect(migrateDatabase).toHaveBeenCalledWith(mockResolved);
  });
});
