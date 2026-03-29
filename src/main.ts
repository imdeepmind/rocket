#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';

import { CLIOptions } from './types';
import { validateConfigPath, validateMode, validatePort } from './validators';

/**
 * CLI Definition
 */
const program = new Command();

program
  .name('rocket')
  .description('Config-driven API server CLI')
  .version('1.0.0')
  .requiredOption('-c, --config <path>', 'Path to config file', validateConfigPath)
  .option('-p, --port <number>', 'Port to run server on (default: 3000)', validatePort, 3000)
  .option('-m, --mode <mode>', 'Mode: dev or prod (default: dev)', validateMode, 'dev')
  .action((options: CLIOptions) => {
    const { config, port, mode } = options;

    console.log(chalk.blue('Starting server with:'));
    console.log(chalk.blue(`Config: ${config}`));
    console.log(chalk.blue(`Port: ${port}`));
    console.log(chalk.blue(`Mode: ${mode}`));
  });

program.parse();
