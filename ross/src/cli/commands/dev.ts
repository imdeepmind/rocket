import * as path from 'path';

import chalk from 'chalk';

import migrateDatabase from '@/migrator';
import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {buildFunctions} from '@/lib/functions/builder';
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
  const configDir = path.dirname(path.resolve(configPath));

  let resolvedConfig;
  try {
    resolvedConfig = resolveAndValidateConfig(
      loadedConfig,
      'dev',
      configDir,
      options,
    );
    await buildFunctions({
      config: resolvedConfig,
      configDir,
    });
  } catch (err) {
    console.error(
      chalk.red('Failed to build functions:'),
      (err as Error).message,
    );
    process.exit(1);
  }

  const port =
    options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const host = options.host ?? '0.0.0.0';
  const verbose = Boolean(options.verbose);
  const migrate = Boolean(options.migrate);

  if (migrate) {
    try {
      console.log(chalk.blue('Running database migrations...'));
      await migrateDatabase(resolvedConfig);
      console.log(chalk.green('Database migrations completed successfully.'));
    } catch (err) {
      console.error(
        chalk.red('Migration failed:'),
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
  }

  console.log(chalk.blue('Starting development server with:'));
  console.log(chalk.blue(`Config: ${configPath}`));
  console.log(chalk.blue(`Port: ${port}`));
  console.log(chalk.blue(`Host: ${host}`));
  console.log(chalk.blue('Mode: dev'));
  console.log(chalk.blue(`Verbose: ${verbose}`));
  console.log(chalk.blue(`Migrate: ${migrate}`));

  const {app, routes} = await startServer(resolvedConfig);

  setupGracefulShutdown(app);

  try {
    await app.listen({port, host});
    showWelcomeScreen(app.appConfig, port, routes);
  } catch (err) {
    console.error(chalk.red('Failed to start server:'), err);
    process.exit(1);
  }
}
