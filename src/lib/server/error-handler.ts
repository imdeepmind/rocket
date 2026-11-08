import {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import {describeDatabaseError} from '@/lib/server/db-errors';

/**
 * Installs the framework error handler.
 *
 * This MUST be called before any route is registered: Fastify resolves the
 * error handler when routes are added, so registering it afterwards leaves
 * every route on the default Fastify error handler (which leaks raw driver
 * errors to clients).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      err: FastifyError & {code?: string},
      req: FastifyRequest,
      reply: FastifyReply,
    ) => {
      req.log.error(err);

      const errRecord = err as unknown as Record<string, unknown>;
      if (errRecord.body) {
        reply
          .status((errRecord.statusCode as number) || 500)
          .send(errRecord.body);
        return;
      }

      // Database driver errors are translated into safe, framework-shaped
      // responses. Raw driver codes/messages never reach the client.
      const databaseError = describeDatabaseError(err);
      if (databaseError) {
        reply
          .status(databaseError.statusCode)
          .send(
            app.buildResponse(
              databaseError.statusCode,
              databaseError.message,
              null,
            ),
          );
        return;
      }

      // Schema validation errors from Fastify/AJV are translated into standard
      // 400 envelopes without leaking internal validation details or FST_ERR_VALIDATION codes.
      if (err.validation || err.code === 'FST_ERR_VALIDATION') {
        reply.status(400).send(app.buildResponse(400, err.message, null));
        return;
      }

      // Default from Fastify or fallback
      let statusCode: number = err.statusCode || 500;
      statusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

      const payload = app.buildResponse(statusCode, err.message, null);

      reply.status(statusCode).send(payload);
    },
  );
}

/**
 * Installs the framework 404 not found handler.
 *
 * Ensures all unmatched routes return the standard Rocket response envelope
 * {"code": 404, "message": "Route <method>:<url> not found", "data": null}.
 */
export function registerNotFoundHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply
      .status(404)
      .send(
        app.buildResponse(
          404,
          `Route ${req.method}:${req.url} not found`,
          null,
        ),
      );
  });
}
