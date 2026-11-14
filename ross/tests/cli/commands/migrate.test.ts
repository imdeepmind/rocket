import {handleMigrate} from '@/cli/commands/migrate';
import * as configFinder from '@/cli/config-finder';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';

vi.mock('@/migrator', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn(),
}));

vi.mock('@/cli/config-finder', () => ({
  resolveConfigPath: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn(s => s),
    green: vi.fn(s => s),
    red: vi.fn(s => s),
  },
}));

describe('cli/commands/migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs database migrations successfully and exits with 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    const mockRaw = {application: {name: 'Migrate App'}};
    const mockResolved = {application: {name: 'Migrate App (Resolved)'}};

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue(mockRaw as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue(mockResolved as never);
    vi.mocked(migrateDatabase).mockResolvedValue(undefined);

    await expect(handleMigrate({config: 'ross.json'})).rejects.toThrow(
      'process.exit: 0',
    );

    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith('ross.json');
    expect(configFinder.loadConfigFile).toHaveBeenCalledWith('/app/ross.json');
    expect(resolveAndValidateConfig).toHaveBeenCalledWith(
      mockRaw,
      'prod',
      '/app',
      {config: 'ross.json'},
    );
    expect(migrateDatabase).toHaveBeenCalledWith(mockResolved);
    expect(logSpy).toHaveBeenCalledWith('Running database migrations...');
    expect(logSpy).toHaveBeenCalledWith(
      'Database migrations completed successfully.',
    );
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('enables dangerouslyAllowDDL on resolved migrations config when dangerouslyAllowDdl is passed', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    const mockRaw = {application: {name: 'Migrate App'}};
    const mockResolved = {
      application: {name: 'Migrate App (Resolved)'},
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgres://localhost:5432/db'},
          timeout: 5000,
          migrations: {
            directory: '/app/migrations',
            dangerouslyAllowDDL: false,
          },
        },
      },
    };

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue(mockRaw as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue(mockResolved as never);
    vi.mocked(migrateDatabase).mockResolvedValue(undefined);

    await expect(
      handleMigrate({config: 'ross.json', dangerouslyAllowDdl: true}),
    ).rejects.toThrow('process.exit: 0');

    expect(resolveAndValidateConfig).toHaveBeenCalledWith(
      mockRaw,
      'prod',
      '/app',
      {config: 'ross.json', dangerouslyAllowDdl: true},
    );
    expect(migrateDatabase).toHaveBeenCalledWith(mockResolved);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when migrateDatabase throws Error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(migrateDatabase).mockRejectedValue(
      new Error('Drizzle connection timeout'),
    );

    await expect(handleMigrate({})).rejects.toThrow('process.exit: 1');

    expect(errorSpy).toHaveBeenCalledWith(
      'Migration failed:',
      'Drizzle connection timeout',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when configuration resolution fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockImplementation(() => {
      throw new Error('Config missing application.name');
    });

    await expect(handleMigrate({})).rejects.toThrow('process.exit: 1');

    expect(migrateDatabase).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Migration failed:',
      'Config missing application.name',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when non-Error thrown', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as unknown as (code?: string | number | null) => never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(migrateDatabase).mockRejectedValue('Fatal string error');

    await expect(handleMigrate({})).rejects.toThrow('process.exit: 1');

    expect(errorSpy).toHaveBeenCalledWith(
      'Migration failed:',
      'Fatal string error',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
