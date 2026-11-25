import { resolveEnvVars } from '../../lib/config/env.js';
import { validateConfig } from '../../validators/config/index.js';
import { resolveConfig } from './resolve.js';
/**
 * Run the full configuration pipeline once:
 *
 *   raw input → env resolution → resolution (defaults) → validation
 *
 * Returns the dense, validated `ResolvedAppConfig` consumed by the server.
 */
export function resolveAndValidateConfig(raw, mode, configDir, cliOptions) {
    const resolved = resolveConfig(resolveEnvVars(raw), {
        mode,
        configDir,
        cliOptions,
    });
    return validateConfig(resolved);
}
//# sourceMappingURL=pipeline.js.map