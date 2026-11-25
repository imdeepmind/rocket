import { AppConfigInput, DefineConfigOptions, ResolvedAppConfig } from '../../interfaces/config.js';
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
export declare function defineConfig(config: AppConfigInput, options?: DefineConfigOptions): ResolvedAppConfig;
