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
  .action(async (options: CLIOptions) => {
    const {config, port, mode} = options;

    console.log(chalk.blue('Starting server with:'));
    console.log(chalk.blue(`Config: ${config}`));
    console.log(chalk.blue(`Port: ${port}`));
    console.log(chalk.blue(`Mode: ${mode}`));

    const loadedConfig = loadConfig(config);
    const app = await startServer(loadedConfig, port, mode);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(chalk.yellow(`\nReceived ${signal}, closing server...`));
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  });

program.parse();
