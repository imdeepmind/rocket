#!/usr/bin/env node
import * as fs from 'fs';

import chalk from 'chalk';
import {Command} from 'commander';

import {startServer} from '@/server';

import {CLIOptions} from '@/interfaces';
import {AppConfig} from '@/interfaces/config';

import {validateConfigPath, validateMode, validatePort} from '@/validators';
import {resolveEnvVars} from '@/utils/config';
import {showWelcomeScreen} from '@/utils/welcome';

/**
 * Load Config
 */
function loadConfig(configPath: string): AppConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  return resolveEnvVars(config);
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

    // Set NODE_ENV based on mode
    process.env.NODE_ENV = mode === 'prod' ? 'production' : 'development';
    const {app, routes} = await startServer(
      loadedConfig,
      port,
      mode,
      verbose,
      migrate,
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(chalk.yellow(`\nReceived ${signal}, closing server...`));
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start listening
    try {
      await app.listen({port, host: '0.0.0.0'});
      showWelcomeScreen(loadedConfig, port, routes);
    } catch (err) {
      console.error(chalk.red('Failed to start server:'), err);
      process.exit(1);
    }
  });

program.parse();
