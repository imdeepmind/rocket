import * as fs from 'fs';

import {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {startServer} from '@/server';

// Setup Mock for Commander
const mockAction = vi.fn();
const mockParse = vi.fn();
const mockCommandObj = {
  name: vi.fn().mockReturnThis(),
  description: vi.fn().mockReturnThis(),
  version: vi.fn().mockReturnThis(),
  requiredOption: vi.fn().mockReturnThis(),
  option: vi.fn().mockReturnThis(),
  action: vi.fn(cb => {
    mockAction.mockImplementation(cb);
    return mockCommandObj;
  }),
  parse: mockParse,
};

vi.mock('commander', () => ({
  // prettier-ignore
  // eslint-disable-next-line prefer-arrow-callback
  Command: vi.fn().mockImplementation(function() {
    return mockCommandObj;
  }),
}));

// Setup other Mocks
vi.mock('../src/server', () => ({
  startServer: vi.fn(),
}));

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {...actual, readFileSync: vi.fn()};
});

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn(s => s),
    yellow: vi.fn(s => s),
    green: vi.fn(s => s),
    red: vi.fn(s => s),
  },
}));

describe('main.ts CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should configure commander and start server upon action invocation', async () => {
    // Dynamically import main to trigger CLI configuration
    await import('../src/main');

    // Verify commander sets up the cli schema
    expect(mockCommandObj.name).toHaveBeenCalledWith('rocket');
    expect(mockCommandObj.description).toHaveBeenCalledWith(
      'Config-driven API server CLI',
    );
    expect(mockCommandObj.version).toHaveBeenCalledWith('1.0.0');
    expect(mockCommandObj.requiredOption).toHaveBeenCalledWith(
      '-c, --config <path>',
      'Path to config file',
      expect.any(Function),
    );
    expect(mockCommandObj.option).toHaveBeenCalledWith(
      '-p, --port <number>',
      'Port to run server on (default: 3000)',
      expect.any(Function),
      3000,
    );
    expect(mockCommandObj.option).toHaveBeenCalledWith(
      '-m, --mode <mode>',
      'Mode: dev or prod (default: dev)',
      expect.any(Function),
      'dev',
    );
    expect(mockCommandObj.option).toHaveBeenCalledWith(
      '-v, --verbose',
      'Enable verbose logging',
      false,
    );
    expect(mockCommandObj.option).toHaveBeenCalledWith(
      '--migrate',
      'Run database migrations',
      false,
    );
    expect(mockCommandObj.action).toHaveBeenCalled();
    expect(mockCommandObj.parse).toHaveBeenCalled();

    // Trigger the callback registered in `.action()`
    const cliOptions = {
      config: 'test.json',
      port: 8080,
      mode: 'prod',
      verbose: true,
      migrate: true,
    };
    const mockAppConfig = {database: {engine: 'pg'}};

    // Mock readFileSync behavior for config loading
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockAppConfig));

    const mockApp = {
      listen: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

    // Execute the action manually
    await mockAction(cliOptions);

    // Verify it loads the config
    expect(fs.readFileSync).toHaveBeenCalledWith('test.json', 'utf-8');

    // Verify it delegates execution to the server instance
    expect(startServer).toHaveBeenCalledWith(
      mockAppConfig,
      8080,
      'prod',
      true,
      true,
    );

    // Verify it starts listening
    expect(mockApp.listen).toHaveBeenCalledWith({port: 8080, host: '0.0.0.0'});
  });

  it('should close app on SIGINT', async () => {
    await import('../src/main');

    const mockApp = {
      close: vi.fn().mockResolvedValue(undefined),
      listen: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

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

    const cliOptions = {
      config: 'test.json',
      port: 8080,
      mode: 'prod',
      verbose: false,
      migrate: false,
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({database: {}}));
    await mockAction(cliOptions);

    if (handlers['SIGINT']) {
      await handlers['SIGINT']();
    }

    expect(mockApp.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should close app on SIGTERM', async () => {
    await import('../src/main');

    const mockApp = {
      close: vi.fn().mockResolvedValue(undefined),
      listen: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

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

    const cliOptions = {
      config: 'test.json',
      port: 8080,
      mode: 'prod',
      verbose: false,
      migrate: false,
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({database: {}}));
    await mockAction(cliOptions);

    if (handlers['SIGTERM']) {
      await handlers['SIGTERM']();
    }

    expect(mockApp.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should force exit on shutdown timeout', async () => {
    vi.useFakeTimers();
    await import('../src/main');

    const mockApp = {
      close: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      listen: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

    const handlers: Record<string | symbol, (...args: unknown[]) => void> = {};
    vi.spyOn(process, 'on').mockImplementation(
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

    await mockAction({config: 'test.json'});

    if (handlers['SIGINT']) {
      handlers['SIGINT']();
    }

    // Advance time by 2 seconds
    vi.advanceTimersByTime(2000);

    expect(exitSpy).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('should exit with 1 on shutdown error', async () => {
    await import('../src/main');

    const mockApp = {
      close: vi.fn().mockRejectedValue(new Error('close error')),
      listen: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

    const handlers: Record<string | symbol, (...args: unknown[]) => void> = {};
    vi.spyOn(process, 'on').mockImplementation(
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

    await mockAction({config: 'test.json'});

    if (handlers['SIGINT']) {
      await handlers['SIGINT']();
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with 1 on listen error', async () => {
    await import('../src/main');

    const mockApp = {
      listen: vi.fn().mockRejectedValue(new Error('listen error')),
    } as unknown as FastifyInstance;
    vi.mocked(startServer).mockResolvedValue(mockApp);

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);

    await mockAction({config: 'test.json'});

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
