import chalk from 'chalk';
import {FastifyInstance} from 'fastify';

/**
 * Registers SIGINT and SIGTERM handlers to gracefully close the Fastify application.
 */
export function setupGracefulShutdown(app: FastifyInstance): void {
  const shutdown = async (signal: string) => {
    console.log(chalk.yellow(`\nReceived ${signal}, closing server...`));
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
