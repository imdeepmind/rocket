import chalk from 'chalk';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {redactConfig} from '@/lib/config/redact';

import {ConfigShowCLIOptions, ConfigValidateCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';

/**
 * Handles 'ross config show' command execution.
 */
export async function handleConfigShow(
  options: ConfigShowCLIOptions,
): Promise<void> {
  const mode = options.mode ?? 'dev';
  try {
    const configPath = resolveConfigPath(options.config);
    const loadedConfig = loadConfigFile(configPath);
    const resolved = resolveAndValidateConfig(loadedConfig, mode);

    if (options.raw) {
      console.warn(
        chalk.yellow(
          'Warning: Printing raw configuration with unredacted secrets.',
        ),
      );
      console.log(JSON.stringify(resolved, null, 2));
    } else {
      console.log(JSON.stringify(redactConfig(resolved), null, 2));
    }
  } catch (err) {
    console.error(chalk.red('Invalid configuration:'), (err as Error).message);
    process.exit(1);
  }
}

/**
 * Handles 'ross config validate' (or 'ross check') command execution.
 */
export async function handleConfigValidate(
  options: ConfigValidateCLIOptions,
): Promise<void> {
  const mode = options.mode ?? 'dev';
  try {
    const configPath = resolveConfigPath(options.config);
    const loadedConfig = loadConfigFile(configPath);
    const resolved = resolveAndValidateConfig(loadedConfig, mode);

    const modelCount = Object.keys(resolved.data.models).length;
    const dbEngine = resolved.infrastructure.database.engine;

    console.log(chalk.green('✓ Configuration is valid!'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  Models:      ${modelCount}`));
    console.log(chalk.gray(`  Database:    ${dbEngine}`));
    console.log(chalk.gray(`  Mode:        ${mode}`));
  } catch (err) {
    console.error(chalk.red('Invalid configuration:'), (err as Error).message);
    process.exit(1);
  }
}
