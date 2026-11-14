import * as path from 'path';

import chalk from 'chalk';

import migrateDatabase from '@/migrator';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';

import {MigrateCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';

/**
 * Handles 'ross migrate' command execution.
 */
export async function handleMigrate(options: MigrateCLIOptions): Promise<void> {
  let migrationFailed = false;
  try {
    const configPath = resolveConfigPath(options.config);
    const configDir = path.dirname(path.resolve(configPath));
    const loadedConfig = loadConfigFile(configPath);
    const resolved = resolveAndValidateConfig(
      loadedConfig,
      'prod',
      configDir,
      options,
    );

    console.log(chalk.blue('Running database migrations...'));
    await migrateDatabase(resolved);
    console.log(chalk.green('Database migrations completed successfully.'));
  } catch (err) {
    migrationFailed = true;
    console.error(
      chalk.red('Migration failed:'),
      err instanceof Error ? err.message : String(err),
    );
  }
  process.exit(migrationFailed ? 1 : 0);
}
