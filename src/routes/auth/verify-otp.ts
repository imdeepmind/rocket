import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {AppConfig} from '@/interfaces/config';

interface VerifyOtpBody {
  email: string;
  otp: string;
  ulid: string;
}

/**
 * Register the POST /auth/verify-otp route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * It verifies the OTP provided by the user using the ULID from the OTP request.
 *
 * @param app     - The Fastify application instance.
 * @param config  - The app configuration.
 */
export function registerVerifyOtpRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  app.post(
    '/auth/verify-otp',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'otp', 'ulid'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
            },
            otp: {
              type: 'string',
              pattern: '^[0-9]{6}$',
              description: '6-digit OTP',
            },
            ulid: {
              type: 'string',
              description: 'ULID of the OTP session',
            },
          },
        },
      },
      config: {apiIdentifier: 'authAPIs->verify-otp'},
    },
    async (
      request: FastifyRequest<{Body: VerifyOtpBody}>,
      reply: FastifyReply,
    ) => {
      const {email, otp, ulid} = request.body;

      try {
        // Verify OTP using the OTP plugin
        const isValid = await app.otp.verify(email, otp, ulid);

        if (isValid) {
          return reply.status(200).send(
            app.buildResponse(200, 'OTP verified successfully', {
              verified: true,
            }),
          );
        } else {
          return reply.status(401).send(
            app.buildResponse(401, 'Invalid or expired OTP', {
              verified: false,
            }),
          );
        }
      } catch (err) {
        app.log.error(`Failed to verify OTP: ${err}`);
        return reply
          .status(500)
          .send(app.buildResponse(500, 'Failed to verify OTP', null));
      }
    },
  );
}
