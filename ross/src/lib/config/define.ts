import {resolveAndValidateConfig} from '@/lib/config/pipeline';

import {Mode} from '@/interfaces';
import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

export interface DefineConfigOptions {
  /** Configuration mode. Defaults to `prod` when NODE_ENV is `production`. */
  mode?: Mode;
  /** Base directory for relative paths such as custom functions/migrations. */
  configDir?: string;
}

/**
 * Runs the full configuration pipeline: environment resolution, default
 * resolution, normalization, and schema validation.
 *
 * The result is the dense `ResolvedAppConfig` consumed by `createServer` and
 * `migrateDatabase`.
 *
 * @param config The raw configuration object to resolve and validate.
 * @param options Optional mode and config directory overrides.
 * @returns The resolved and validated configuration.
 */
export function defineConfig(
  config: AppConfigInput,
  options: DefineConfigOptions = {},
): ResolvedAppConfig {
  const mode: Mode =
    options.mode ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');

  return resolveAndValidateConfig(config, mode, options.configDir);
}
