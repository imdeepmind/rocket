import { startServer } from './server.js';
import { defineConfig } from './lib/config/define.js';
import './types/fastify.js';
export { default as migrateDatabase } from './migrator/index.js';
export { defineConfig };
/**
 * Resolves, validates, and builds a fully configured Fastify application.
 *
 * The raw configuration goes through the same pipeline as `defineConfig()`,
 * so defaults, environment variables, and validation are always applied.
 *
 * The caller owns the HTTP lifecycle: call `app.listen()` when ready, hand the
 * app to a test harness, or attach additional hooks/plugins.
 */
export async function createServer(config, options = {}) {
    return startServer(defineConfig(config, options));
}
//# sourceMappingURL=index.js.map