import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';

import { CLIOptions } from './types';

export async function startServer(options: CLIOptions) {
  const { port, mode } = options;

  const app: FastifyInstance = Fastify({
    logger: mode === 'dev',
  });

  // Global error handler
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    req.log.error(err);
    reply.status(500).send({ error: err.message });
  });

  try {
    await app.listen({ port });
    console.log(`Server running at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
