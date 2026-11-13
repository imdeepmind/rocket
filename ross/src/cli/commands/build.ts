import * as path from 'path';

import chalk from 'chalk';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {buildFunctions} from '@/lib/functions/builder';

import {BuildCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';

/**
 * Handles 'ross build' command execution.
 */
export async function handleBuild(options: BuildCLIOptions): Promise<void> {
  const verbose = Boolean(options.verbose);
  try {
    const configPath = resolveConfigPath(options.config);
    const configDir = path.dirname(path.resolve(configPath));
    const loadedConfig = loadConfigFile(configPath);
    const resolved = resolveAndValidateConfig(loadedConfig, 'prod');

    if (verbose) {
      console.log(chalk.blue('Building function endpoints with:'));
      console.log(chalk.blue(`Config: ${configPath}`));
      console.log(chalk.blue(`Working directory: ${configDir}`));
    }

    const results = await buildFunctions({
      config: resolved,
      configDir,
    });

    if (results.length === 0) {
      console.log(
        chalk.yellow('No custom function endpoints configured to build.'),
      );
    } else {
      console.log(
        chalk.green(
          `✓ Successfully built ${results.length} function endpoint${results.length === 1 ? '' : 's'}:`,
        ),
      );
      for (const res of results) {
        console.log(
          chalk.gray(
            `  - ${res.endpointName} (${res.exportName}) -> ${path.relative(configDir, res.outputFile)}`,
          ),
        );
      }
    }
  } catch (err) {
    console.error(chalk.red('Build failed:'), (err as Error).message);
    process.exit(1);
  }
}
