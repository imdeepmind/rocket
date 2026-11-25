import { resolveAndValidateConfig } from '../../lib/config/pipeline.js';
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
export function defineConfig(config, options = {}) {
    const mode = options.mode ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
    return resolveAndValidateConfig(config, mode, options.configDir);
}
//# sourceMappingURL=define.js.map