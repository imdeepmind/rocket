import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {AppConfig} from '@/interfaces/config';

import {hash} from '@/utils/hash';

interface VerifyOtpBody {
  email: string;
  otp: string;
  ulid: string;
  password?: string;
}

interface VerifyOtpParams {
  operation: string;
}

/**
 * Register the POST /auth/verify-otp/:operation route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * It verifies the OTP provided by the user using the ULID from the OTP request.
 * Supported operations:
 *   - registration: Sets the isVerifiedColumn to true
 *   - mfa: Returns an access token (JWT)
 *   - password-reset: Updates the password in the database
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

  const {
    modelName,
    idColumn,
    usernameColumn,
    passwordColumn,
    isVerifiedColumn,
  } = auth.authModel;

  // Find the model config that matches the authModel.modelName
  const authModelConfig = config.models.find(m => m.name === modelName);

  if (!authModelConfig) {
    app.log.warn(
      `[auth/verify-otp] Could not find model config for "${modelName}". Skipping route registration.`,
    );
    return;
  }

  app.post(
    '/auth/verify-otp/:operation',
    {
      schema: {
        params: {
          type: 'object',
          required: ['operation'],
          properties: {
            operation: {
              type: 'string',
              enum: ['registration', 'mfa', 'password-reset'],
              description: 'The operation type for OTP verification',
            },
          },
        },
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
            password: {
              type: 'string',
              description:
                'New password (required for password-reset operation)',
            },
          },
        },
      },
      config: {apiIdentifier: 'authAPIs->verify-otp'},
    },
    async (
      request: FastifyRequest<{Body: VerifyOtpBody; Params: VerifyOtpParams}>,
      reply: FastifyReply,
    ) => {
      const {email, otp, ulid} = request.body;
      const {operation} = request.params;

      try {
        // Verify OTP using the OTP plugin
        const isValid = await app.otp.verify(email, otp, ulid);

        if (!isValid) {
          return reply.status(401).send(
            app.buildResponse(401, 'Invalid or expired OTP', {
              verified: false,
            }),
          );
        }

        // Find user by email
        const userQuery = `SELECT * FROM "${modelName}" WHERE "email" = $1 LIMIT 1;`;
        const userRes = await app.db.query(userQuery, [email]);

        if (userRes.rows.length === 0) {
          return reply
            .status(404)
            .send(app.buildResponse(404, 'User not found', null));
        }

        const user = userRes.rows[0] as Record<string, unknown>;

        // Handle different operations
        if (operation === 'registration') {
          // Set isVerifiedColumn to true
          if (!isVerifiedColumn) {
            return reply
              .status(500)
              .send(
                app.buildResponse(
                  500,
                  'isVerifiedColumn is not configured',
                  null,
                ),
              );
          }

          const updateQuery = `UPDATE "${modelName}" SET "${isVerifiedColumn}" = true WHERE "email" = $1;`;
          await app.db.query(updateQuery, [email]);

          return reply.status(200).send(
            app.buildResponse(200, 'OTP verified successfully', {
              verified: true,
            }),
          );
        } else if (operation === 'mfa') {
          // Generate and return JWT access token
          const payload = {
            id: user[idColumn],
            [usernameColumn]: user[usernameColumn],
          };

          const token = app.jwt.sign(payload, {
            expiresIn: '1d',
          });

          return reply.status(200).send(
            app.buildResponse(200, 'OTP verified successfully', {
              verified: true,
              accessToken: token,
            }),
          );
        } else if (operation === 'password-reset') {
          // Hash password and update in DB
          const {password} = request.body;

          if (!password) {
            return reply
              .status(400)
              .send(
                app.buildResponse(
                  400,
                  'Password is required for password-reset operation',
                  null,
                ),
              );
          }

          const hashedPassword = await hash(String(password));
          const updateQuery = `UPDATE "${modelName}" SET "${passwordColumn}" = $1 WHERE "email" = $2;`;
          await app.db.query(updateQuery, [hashedPassword, email]);

          return reply.status(200).send(
            app.buildResponse(200, 'Password reset successfully', {
              verified: true,
            }),
          );
        }

        // Should not reach here due to enum validation in schema
        return reply
          .status(400)
          .send(app.buildResponse(400, 'Invalid operation', null));
      } catch (err) {
        app.log.error(`Failed to verify OTP: ${err}`);
        return reply
          .status(500)
          .send(app.buildResponse(500, 'Failed to verify OTP', null));
      }
    },
  );
}
