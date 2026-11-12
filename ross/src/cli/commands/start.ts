import chalk from 'chalk';

import {startServer} from '@/server';

import {showWelcomeScreen} from '@/lib/server/welcome';

import {StartCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';
import {setupGracefulShutdown} from '../shutdown';

/**
 * Handles 'ross start' (or 'ross serve') command execution.
 */
export async function handleStart(options: StartCLIOptions): Promise<void> {
  process.env.NODE_ENV = 'production';

  const configPath = resolveConfigPath(options.config);
  const loadedConfig = loadConfigFile(configPath);

  const port =
    options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const host = options.host ?? '0.0.0.0';
  const verbose = Boolean(options.verbose);

  console.log(chalk.blue('Starting production server with:'));
  console.log(chalk.blue(`Config: ${configPath}`));
  console.log(chalk.blue(`Port: ${port}`));
  console.log(chalk.blue(`Host: ${host}`));
  console.log(chalk.blue('Mode: prod'));
  console.log(chalk.blue(`Verbose: ${verbose}`));

  const {app, routes} = await startServer(
    loadedConfig,
    port,
    'prod',
    verbose,
    false,
  );

  setupGracefulShutdown(app);

  try {
    await app.listen({port, host});
    showWelcomeScreen(app.appConfig, port, routes);
  } catch (err) {
    console.error(chalk.red('Failed to start server:'), err);
    process.exit(1);
  }
}
