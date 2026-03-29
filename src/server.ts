import chalk from 'chalk';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';

import { CLIOptions } from './types';

export async function startServer(options: CLIOptions) {
  const { port, mode } = options;

  const app: FastifyInstance = Fastify({
    logger:
      mode === 'dev'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : true,
  });

  // Global error handler
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    req.log.error(err);
    reply.status(500).send({ error: err.message });
  });

  try {
    await app.listen({ port });
    console.log(chalk.blue(`Server running at http://localhost:${port}`));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
