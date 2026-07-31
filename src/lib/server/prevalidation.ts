import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {AppConfig} from '@/interfaces/config';

/**
 * Auth + SSP checks that can be performed in preValidation.
 */
export type PreValidationCheck = 'auth' | 'ssp';

/**
 * Build a preValidation handler that runs the specified checks.
 *
 *   - 'auth': authenticate the request if auth is enabled + authorization flag is set
 *   - 'ssp':  enforce single-session-policy
 */
export function buildPreValidation(
  app: FastifyInstance,
  config: AppConfig,
  authorization: boolean,
  checks: PreValidationCheck[] = ['auth'],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void | undefined> {
  return async (request, reply) => {
    if (
      checks.includes('auth') &&
      config.authentication?.enabled &&
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
    if (checks.includes('ssp')) {
      app.enforceSSP(request);
    }
  };
}
