import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import * as fs from 'fs';

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
import {startServer} from '../src/server';
vi.mock('../src/server', () => ({
  startServer: vi.fn(),
}));

vi.mock('fs', async importOriginal => {
  // prettier-ignore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();
  return {...actual, readFileSync: vi.fn()};
});

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn(s => s),
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
    expect(mockCommandObj.action).toHaveBeenCalled();
    expect(mockCommandObj.parse).toHaveBeenCalled();

    // Trigger the callback registered in `.action()`
    const cliOptions = {config: 'test.json', port: 8080, mode: 'prod'};
    const mockAppConfig = {database: {engine: 'pg'}};

    // Mock readFileSync behavior for config loading
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockAppConfig));

    // Execute the action manually
    await mockAction(cliOptions);

    // Verify it loads the config
    expect(fs.readFileSync).toHaveBeenCalledWith('test.json', 'utf-8');

    // Verify it delegates execution to the server instance
    expect(startServer).toHaveBeenCalledWith(mockAppConfig, 8080, 'prod');
  });
});
