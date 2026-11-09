import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {ResolvedAppConfig} from '@/interfaces/config';

/**
 * Checks that can be performed in preValidation.
 *
 * SSP injection is deliberately not supported here: `preValidation` runs
 * before AJV validation and before the route-level auth hook populates
 * `request.user`, so injected params would be stripped by `removeAdditional`
 * and `[[userId]]` / `[[userEmail]]` would resolve to `undefined`. SSP must run
 * in the global `preHandler` hook instead (see `src/server.ts`).
 */
export type PreValidationCheck = 'auth';

/**
 * Build a preValidation handler that runs the specified checks.
 *
 *   - 'auth': authenticate the request if auth is enabled + authorization flag is set
 */
export function buildPreValidation(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  authorization: boolean,
  checks: PreValidationCheck[] = ['auth'],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void | undefined> {
  return async (request, reply) => {
    if (
      checks.includes('auth') &&
      config.authentication.enabled &&
      authorization
    ) {
      try {
        await request.authenticate();
      } catch {
        return reply
          .status(401)
          .send(
            app.buildResponse(
              401,
              'Invalid or expired authentication token',
              null,
            ),
          );
      }
    }
  };
}
