import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {AppConfig, ModelBody} from '@/interfaces/config';

/**
 * Register the POST /auth/password-reset route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * It allows users to initiate a password reset by providing their email.
 * An OTP is sent to the email for verification.
 * The user then calls /auth/verify-otp/password-reset with the OTP and new password.
 *
 * @param app     - The Fastify application instance.
 * @param config  - The app configuration.
 */
export function registerPasswordResetRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  const {modelName} = auth.authModel;

  // Find the model config that matches the authModel.modelName
  const authModelConfig = config.models.find(m => m.name === modelName);

  if (!authModelConfig) {
    app.log.warn(
      `[auth/password-reset] Could not find model config for "${modelName}". Skipping route registration.`,
    );
    return;
  }

  app.post(
    '/auth/password-reset',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to send password reset OTP to',
            },
          },
        },
      },
      config: {apiIdentifier: 'authAPIs->password-reset'},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {email} = request.body;

      try {
        // Check if user exists with this email
        const query = `SELECT * FROM "${modelName}" WHERE "email" = $1 LIMIT 1;`;
        const res = await app.db.query(query, [email]);

        if (res.rows.length === 0) {
          return reply
            .status(404)
            .send(app.buildResponse(404, 'User not found', null));
        }

        // Generate and send OTP for password reset
        const otpUlid = await app.otp.sendOTPForVerification(String(email));

        return reply.status(200).send(
          app.buildResponse(200, 'Password reset OTP sent successfully', {
            otp_id: otpUlid,
          }),
        );
      } catch (err) {
        app.log.error(`Failed to initiate password reset: ${err}`);
        return reply
          .status(500)
          .send(
            app.buildResponse(500, 'Failed to initiate password reset', null),
          );
      }
    },
  );
}
