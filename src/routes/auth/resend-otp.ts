import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {AppConfig, ModelBody} from '@/interfaces/config';

/**
 * Register the POST /auth/resend-otp route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * It allows users to resend OTP to their email.
 *
 * @param app     - The Fastify application instance.
 * @param config  - The app configuration.
 */
export function registerResendOtpRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  app.post(
    '/auth/resend-otp',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to resend OTP to',
            },
          },
        },
      },
      config: {apiIdentifier: 'authAPIs->resend-otp'},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {email} = request.body;

      try {
        // Generate and send a new OTP to the email
        const newUlid = await app.otp.sendOTPForVerification(String(email));

        return reply.status(200).send(
          app.buildResponse(200, 'OTP resent successfully', {
            otp_id: newUlid,
          }),
        );
      } catch (err) {
        app.log.error(`Failed to resend OTP: ${err}`);
        return reply
          .status(500)
          .send(app.buildResponse(500, 'Failed to resend OTP', null));
      }
    },
  );
}
