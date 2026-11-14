import {Command} from 'commander';

import {validateConfigPath, validateMode, validatePort} from '@/validators';

import {handleBuild} from './commands/build';
import {handleConfigShow, handleConfigValidate} from './commands/config';
import {handleDev} from './commands/dev';
import {handleMigrate} from './commands/migrate';
import {handleRoutes} from './commands/routes';
import {handleStart} from './commands/start';

/**
 * Constructs and configures the Commander CLI program for ROSS.
 */
export function buildCli(): Command {
  const program = new Command();

  program
    .name('ross')
    .description('The open-source, configuration-driven backend API framework')
    .version('1.0.0');

  // Subcommand: dev
  program
    .command('dev')
    .description('Start development server')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-p, --port <number>',
      'Port to run server on (default: 3000)',
      validatePort,
    )
    .option(
      '-H, --host <host>',
      'Host to bind to (default: 0.0.0.0)',
      '0.0.0.0',
    )
    .option('-m, --migrate', 'Run database migrations before starting', false)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(handleDev);

  // Subcommand: start (alias: serve)
  program
    .command('start')
    .alias('serve')
    .description('Start production server')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-p, --port <number>',
      'Port to run server on (default: 3000)',
      validatePort,
    )
    .option(
      '-H, --host <host>',
      'Host to bind to (default: 0.0.0.0)',
      '0.0.0.0',
    )
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(handleStart);

  // Subcommand: migrate (alias: db:push)
  program
    .command('migrate')
    .alias('db:push')
    .description('Run database migrations and exit')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '--dangerously-allow-ddl',
      'Allow custom migrations containing DDL statements',
      false,
    )
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(handleMigrate);

  // Subcommand: build
  program
    .command('build')
    .description('Build custom function endpoints into standalone bundles')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(handleBuild);

  // Subcommand group: config
  const configCmd = program
    .command('config')
    .description('Inspect and validate configuration');

  configCmd
    .command('show')
    .description('Resolve, redact, and print configuration')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-m, --mode <mode>',
      'Mode: dev or prod (default: dev)',
      validateMode,
      'dev',
    )
    .option('--raw', 'Print raw configuration with unredacted secrets', false)
    .action(handleConfigShow);

  configCmd
    .command('validate')
    .alias('check')
    .description('Validate configuration file syntax, schema, and relations')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-m, --mode <mode>',
      'Mode: dev or prod (default: dev)',
      validateMode,
      'dev',
    )
    .action(handleConfigValidate);

  // Top-level alias: check
  program
    .command('check')
    .description('Alias for "config validate"')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-m, --mode <mode>',
      'Mode: dev or prod (default: dev)',
      validateMode,
      'dev',
    )
    .action(handleConfigValidate);

  // Subcommand: routes
  program
    .command('routes')
    .description('List all registered API routes')
    .option('-c, --config <path>', 'Path to config file', validateConfigPath)
    .option(
      '-m, --mode <mode>',
      'Mode: dev or prod (default: dev)',
      validateMode,
      'dev',
    )
    .action(handleRoutes);

  return program;
}

/**
 * CLI Entrypoint runner.
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const cli = buildCli();
  await cli.parseAsync(argv);
}
