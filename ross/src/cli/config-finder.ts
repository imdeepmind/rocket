import * as fs from 'fs';
import * as path from 'path';

import {InvalidArgumentError} from 'commander';

import {AppConfigInput} from '@/interfaces/config';

export const DEFAULT_CONFIG_CANDIDATES = [
  'ross.json',
  'config.json',
  'ross.config.json',
  'example_config.json',
];

/**
 * Resolves the configuration file path based on user input, environment variable,
 * or default candidate file names in the current working directory.
 */
export function resolveConfigPath(
  specifiedPath?: string,
  cwd: string = process.cwd(),
): string {
  if (specifiedPath) {
    const resolved = path.resolve(cwd, specifiedPath);
    if (!fs.existsSync(resolved)) {
      throw new InvalidArgumentError(`Config file not found: ${resolved}`);
    }
    if (!fs.statSync(resolved).isFile()) {
      throw new InvalidArgumentError(`Not a file: ${resolved}`);
    }
    return resolved;
  }

  if (process.env.ROSS_CONFIG) {
    const envResolved = path.resolve(cwd, process.env.ROSS_CONFIG);
    if (!fs.existsSync(envResolved)) {
      throw new InvalidArgumentError(
        `Config file specified by ROSS_CONFIG not found: ${envResolved}`,
      );
    }
    if (!fs.statSync(envResolved).isFile()) {
      throw new InvalidArgumentError(`Not a file: ${envResolved}`);
    }
    return envResolved;
  }

  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    const candidatePath = path.resolve(cwd, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
  }

  throw new InvalidArgumentError(
    'No configuration file found. Provide one via -c, --config <path> or create a ross.json in the current directory.',
  );
}

/**
 * Reads and parses the configuration JSON file from disk.
 */
export function loadConfigFile(configPath: string): AppConfigInput {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as AppConfigInput;
}
