import { AppConfigInput } from '../interfaces/config.js';
export declare const DEFAULT_CONFIG_CANDIDATES: string[];
/**
 * Resolves the configuration file path based on user input, environment variable,
 * or default candidate file names in the current working directory.
 */
export declare function resolveConfigPath(specifiedPath?: string, cwd?: string): string;
/**
 * Reads and parses the configuration JSON file from disk.
 */
export declare function loadConfigFile(configPath: string): AppConfigInput;
