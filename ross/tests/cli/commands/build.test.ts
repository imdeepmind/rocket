import * as path from 'path';

import {handleBuild} from '@/cli/commands/build';
import * as configFinder from '@/cli/config-finder';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {buildFunctions} from '@/lib/functions/builder';

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn(),
}));

vi.mock('@/lib/functions/builder', () => ({
  buildFunctions: vi.fn(),
}));

vi.mock('@/cli/config-finder', () => ({
  resolveConfigPath: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
  },
}));

describe('cli/commands/build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds functions and logs success when multiple endpoints are compiled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockRaw = {application: {name: 'Test App'}};
    const mockResolved = {
      application: {name: 'Test App'},
      customEndpoints: {
        ep1: {
          handler: {type: 'function', file: 'fn1.ts', exportName: 'handler1'},
        },
        ep2: {
          handler: {type: 'function', file: 'fn2.ts', exportName: 'handler2'},
        },
      },
    };

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue(mockRaw as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue(mockResolved as never);
    vi.mocked(buildFunctions).mockResolvedValue([
      {
        endpointName: 'ep1',
        sourceFile: '/app/fn1.ts',
        outputFile: '/app/.ross/functions/fn1.js',
        exportName: 'handler1',
      },
      {
        endpointName: 'ep2',
        sourceFile: '/app/fn2.ts',
        outputFile: '/app/.ross/functions/fn2.js',
        exportName: 'handler2',
      },
    ]);

    await handleBuild({});

    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith(undefined);
    expect(configFinder.loadConfigFile).toHaveBeenCalledWith('/app/ross.json');
    expect(resolveAndValidateConfig).toHaveBeenCalledWith(mockRaw, 'prod');
    expect(buildFunctions).toHaveBeenCalledWith({
      config: mockResolved,
      configDir: '/app',
    });

    expect(logSpy).toHaveBeenCalledWith(
      '✓ Successfully built 2 function endpoints:',
    );
    expect(logSpy).toHaveBeenCalledWith(
      `  - ep1 (handler1) -> ${path.join('.ross', 'functions', 'fn1.js')}`,
    );
    expect(logSpy).toHaveBeenCalledWith(
      `  - ep2 (handler2) -> ${path.join('.ross', 'functions', 'fn2.js')}`,
    );

    logSpy.mockRestore();
  });

  it('logs singular "endpoint" when exactly one endpoint is compiled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(buildFunctions).mockResolvedValue([
      {
        endpointName: 'singleEp',
        sourceFile: '/app/fn.ts',
        outputFile: '/app/.ross/functions/fn.js',
        exportName: 'default',
      },
    ]);

    await handleBuild({});

    expect(logSpy).toHaveBeenCalledWith(
      '✓ Successfully built 1 function endpoint:',
    );
    expect(logSpy).toHaveBeenCalledWith(
      `  - singleEp (default) -> ${path.join('.ross', 'functions', 'fn.js')}`,
    );

    logSpy.mockRestore();
  });

  it('logs warning when no function endpoints are defined', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(buildFunctions).mockResolvedValue([]);

    await handleBuild({});

    expect(logSpy).toHaveBeenCalledWith(
      'No custom function endpoints configured to build.',
    );

    logSpy.mockRestore();
  });

  it('logs verbose details when verbose option is true', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
      '/workspace/custom.json',
    );
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(buildFunctions).mockResolvedValue([]);

    await handleBuild({config: 'custom.json', verbose: true});

    expect(configFinder.resolveConfigPath).toHaveBeenCalledWith('custom.json');
    expect(logSpy).toHaveBeenCalledWith('Building function endpoints with:');
    expect(logSpy).toHaveBeenCalledWith('Config: /workspace/custom.json');
    expect(logSpy).toHaveBeenCalledWith('Working directory: /workspace');

    logSpy.mockRestore();
  });

  it('logs error and exits with 1 when resolveConfigPath fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    vi.mocked(configFinder.resolveConfigPath).mockImplementation(() => {
      throw new Error('Config file not found: missing.json');
    });

    await handleBuild({config: 'missing.json'});

    expect(errorSpy).toHaveBeenCalledWith(
      'Build failed:',
      'Config file not found: missing.json',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when resolveAndValidateConfig fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockImplementation(() => {
      throw new Error('Validation failed');
    });

    await handleBuild({});

    expect(errorSpy).toHaveBeenCalledWith('Build failed:', 'Validation failed');
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs error and exits with 1 when buildFunctions fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    vi.mocked(configFinder.resolveConfigPath).mockReturnValue('/app/ross.json');
    vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
    vi.mocked(resolveAndValidateConfig).mockReturnValue({} as never);
    vi.mocked(buildFunctions).mockRejectedValue(
      new Error('esbuild compilation error: SyntaxError'),
    );

    await handleBuild({});

    expect(errorSpy).toHaveBeenCalledWith(
      'Build failed:',
      'esbuild compilation error: SyntaxError',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
