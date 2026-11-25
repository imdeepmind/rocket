import * as path from 'path';
import chalk from 'chalk';
import { startServer } from '../../server.js';
import { resolveAndValidateConfig } from '../../lib/config/pipeline.js';
import { showWelcomeScreen } from '../../lib/server/welcome.js';
import { loadConfigFile, resolveConfigPath } from '../config-finder.js';
import { setupGracefulShutdown } from '../shutdown.js';
/**
 * Handles 'ross start' (or 'ross serve') command execution.
 */
export async function handleStart(options) {
    process.env.NODE_ENV = 'prod';
    const configPath = resolveConfigPath(options.config);
    const configDir = path.dirname(path.resolve(configPath));
    const loadedConfig = loadConfigFile(configPath);
    const resolvedConfig = resolveAndValidateConfig(loadedConfig, 'prod', configDir, options);
    const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
    const host = options.host ?? '0.0.0.0';
    const verbose = Boolean(options.verbose);
    console.log(chalk.blue('Starting production server with:'));
    console.log(chalk.blue(`Config: ${configPath}`));
    console.log(chalk.blue(`Port: ${port}`));
    console.log(chalk.blue(`Host: ${host}`));
    console.log(chalk.blue('Mode: prod'));
    console.log(chalk.blue(`Verbose: ${verbose}`));
    const { app, routes } = await startServer(resolvedConfig);
    setupGracefulShutdown(app);
    try {
        await app.listen({ port, host });
        showWelcomeScreen(app.appConfig, port, routes);
    }
    catch (err) {
        console.error(chalk.red('Failed to start server:'), err);
        process.exit(1);
    }
}
//# sourceMappingURL=start.js.map