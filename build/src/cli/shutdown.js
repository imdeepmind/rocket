import chalk from 'chalk';
/**
 * Registers SIGINT and SIGTERM handlers to gracefully close the Fastify application.
 */
export function setupGracefulShutdown(app) {
    const shutdown = async (signal) => {
        console.log(chalk.yellow(`\nReceived ${signal}, closing server...`));
        await app.close();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
//# sourceMappingURL=shutdown.js.map