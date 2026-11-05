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

      // Default from Fastify or fallback
      let statusCode: number = err.statusCode || 500;
      statusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

      const payload = app.buildResponse(statusCode, err.message, null, {
        error: err.name,
        code: err.code,
        ...(err.validation ? {validation: err.validation} : {}),
      });

      reply.status(statusCode).send(payload);
    },
  );
}
