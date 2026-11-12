import {buildCli, runCli} from '@/cli';
import * as configCommand from '@/cli/commands/config';
import * as devCommand from '@/cli/commands/dev';
import * as migrateCommand from '@/cli/commands/migrate';
import * as routesCommand from '@/cli/commands/routes';
import * as startCommand from '@/cli/commands/start';
import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/validators', () => ({
  validateConfigPath: vi.fn(val => val),
  validatePort: vi.fn(val => Number(val)),
  validateMode: vi.fn(val => val),
}));

vi.mock('@/cli/commands/dev', () => ({
  handleDev: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/cli/commands/start', () => ({
  handleStart: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/cli/commands/migrate', () => ({
  handleMigrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/cli/commands/config', () => ({
  handleConfigShow: vi.fn().mockResolvedValue(undefined),
  handleConfigValidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/cli/commands/routes', () => ({
  handleRoutes: vi.fn().mockResolvedValue(undefined),
}));

describe('cli/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds commander instance with correct metadata and subcommands', () => {
    const cli = buildCli();
    expect(cli.name()).toBe('ross');
    expect(cli.description()).toBe(
      'The open-source, configuration-driven backend API framework',
    );
    expect(cli.version()).toBe('1.0.0');

    const commandNames = cli.commands.map(cmd => cmd.name());
    expect(commandNames).toContain('dev');
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('migrate');
    expect(commandNames).toContain('config');
    expect(commandNames).toContain('check');
    expect(commandNames).toContain('routes');
  });

  it('dispatches "ross dev" to handleDev', async () => {
    const cli = buildCli();
    await cli.parseAsync([
      'node',
      'ross',
      'dev',
      '-c',
      'test.json',
      '-p',
      '4000',
    ]);

    expect(devCommand.handleDev).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
        port: 4000,
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross start" to handleStart', async () => {
    const cli = buildCli();
    await cli.parseAsync(['node', 'ross', 'start', '-c', 'test.json']);

    expect(startCommand.handleStart).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross migrate" to handleMigrate', async () => {
    const cli = buildCli();
    await cli.parseAsync(['node', 'ross', 'migrate', '-c', 'test.json']);

    expect(migrateCommand.handleMigrate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross config show" to handleConfigShow', async () => {
    const cli = buildCli();
    await cli.parseAsync(['node', 'ross', 'config', 'show', '-c', 'test.json']);

    expect(configCommand.handleConfigShow).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross config validate" to handleConfigValidate', async () => {
    const cli = buildCli();
    await cli.parseAsync([
      'node',
      'ross',
      'config',
      'validate',
      '-c',
      'test.json',
    ]);

    expect(configCommand.handleConfigValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross check" alias to handleConfigValidate', async () => {
    const cli = buildCli();
    await cli.parseAsync(['node', 'ross', 'check', '-c', 'test.json']);

    expect(configCommand.handleConfigValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('dispatches "ross routes" to handleRoutes', async () => {
    const cli = buildCli();
    await cli.parseAsync(['node', 'ross', 'routes', '-c', 'test.json']);

    expect(routesCommand.handleRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        config: 'test.json',
      }),
      expect.anything(),
    );
  });

  it('runCli parses provided argv or process.argv', async () => {
    await runCli(['node', 'ross', 'dev', '-c', 'test.json']);
    expect(devCommand.handleDev).toHaveBeenCalled();
  });
});
