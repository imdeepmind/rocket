import chalk from 'chalk';

import {startServer} from '@/server';

import {showWelcomeScreen} from '@/lib/server/welcome';

import {DevCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';
import {setupGracefulShutdown} from '../shutdown';

/**
 * Handles 'ross dev' command execution.
 */
export async function handleDev(options: DevCLIOptions): Promise<void> {
  process.env.NODE_ENV = 'development';

  const configPath = resolveConfigPath(options.config);
  const loadedConfig = loadConfigFile(configPath);

  const port =
    options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const host = options.host ?? '0.0.0.0';
  const verbose = Boolean(options.verbose);
  const migrate = Boolean(options.migrate);

  console.log(chalk.blue('Starting development server with:'));
  console.log(chalk.blue(`Config: ${configPath}`));
  console.log(chalk.blue(`Port: ${port}`));
  console.log(chalk.blue(`Host: ${host}`));
  console.log(chalk.blue('Mode: dev'));
  console.log(chalk.blue(`Verbose: ${verbose}`));
  console.log(chalk.blue(`Migrate: ${migrate}`));

  const {app, routes} = await startServer(
    loadedConfig,
    port,
    'dev',
    verbose,
    migrate,
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
