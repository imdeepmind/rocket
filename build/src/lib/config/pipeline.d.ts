import { CLIOptions, Mode } from '../../interfaces/index.js';
import { AppConfigInput, ResolvedAppConfig } from '../../interfaces/config.js';
/**
 * Run the full configuration pipeline once:
 *
 *   raw input → env resolution → resolution (defaults) → validation
 *
 * Returns the dense, validated `ResolvedAppConfig` consumed by the server.
 */
export declare function resolveAndValidateConfig(raw: AppConfigInput, mode: Mode, configDir?: string, cliOptions?: CLIOptions): ResolvedAppConfig;
