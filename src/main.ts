#!/usr/bin/env node
import * as fs from 'fs';

import chalk from 'chalk';
import {Command} from 'commander';

import {startServer} from '@/server';

import {CLIOptions} from '@/schema';
import {AppConfig} from '@/schema/config';

import {validateConfigPath, validateMode, validatePort} from '@/validators';

/**
 * Load Config
 */
function loadConfig(configPath: string): AppConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * CLI Definition
 */
const program = new Command();

program
  .name('rocket')
  .description('Config-driven API server CLI')
  .version('1.0.0')
  .requiredOption(
    '-c, --config <path>',
    'Path to config file',
    validateConfigPath,
  )
  .option(
    '-p, --port <number>',
    'Port to run server on (default: 3000)',
    validatePort,
    3000,
  )
  .option(
    '-m, --mode <mode>',
    'Mode: dev or prod (default: dev)',
    validateMode,
    'dev',
  )
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--migrate', 'Run database migrations', false)
  .action(async (options: CLIOptions) => {
    const {config, port, mode, verbose, migrate} = options;

    console.log(chalk.blue('Starting server with:'));
    console.log(chalk.blue(`Config: ${config}`));
    console.log(chalk.blue(`Port: ${port}`));
    console.log(chalk.blue(`Mode: ${mode}`));
    console.log(chalk.blue(`Verbose: ${verbose}`));
    console.log(chalk.blue(`Migrate: ${migrate}`));

    const loadedConfig = loadConfig(config);
    const app = await startServer(loadedConfig, port, mode, verbose, migrate);

    // Graceful shutdown
    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.log(chalk.yellow(`\nReceived ${signal}, closing server...`));

      // Force exit after a timeout
      const forceExitTimeout = setTimeout(() => {
        console.log(
          chalk.red('\nGraceful shutdown timed out, forcing exit...'),
        );
        process.exit(1);
      }, 2000); // 2 seconds

      try {
        await app.close();
        clearTimeout(forceExitTimeout);
        console.log(chalk.green('Server closed successfully.'));
        process.exit(0);
      } catch (err) {
        console.error(chalk.red('\nError during shutdown:'), err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start listening
    try {
      await app.listen({port, host: '0.0.0.0'});
    } catch (err) {
      console.error(chalk.red('Failed to start server:'), err);
      process.exit(1);
    }
  });

program.parse();
