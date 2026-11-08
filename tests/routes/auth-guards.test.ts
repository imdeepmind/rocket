import Fastify, {FastifyInstance} from 'fastify';
import {describe, expect, test} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';

import {registerEmailChangeRoute} from '@/routes/auth/change-email';
import {registerChangePasswordRoute} from '@/routes/auth/change-password';
import {registerDeleteMeRoute} from '@/routes/auth/delete-me';
import {registerEditMeRoute} from '@/routes/auth/edit-me';
import {registerForgotPasswordRoute} from '@/routes/auth/forgot-password';
import {registerLoginRoute} from '@/routes/auth/login';
import {registerMeRoute} from '@/routes/auth/me';
import {
  registerForgotPasswordOtpVerifyRoute,
  registerLoginOtpVerifyRoute,
  registerRegistrationOtpVerifyRoute,
} from '@/routes/auth/otp-verify';
import {registerRegistrationRoute} from '@/routes/auth/registration';
import {
  registerForgotPasswordResendOtpRoute,
  registerLoginResendOtpRoute,
  registerRegistrationResendOtpRoute,
} from '@/routes/auth/resend-otp';

import {ResolvedAppConfig} from '@/interfaces/config';

type AuthRegistrar = (app: FastifyInstance, config: ResolvedAppConfig) => void;

const registrars: Array<[string, AuthRegistrar]> = [
  ['login', registerLoginRoute],
  ['registration', registerRegistrationRoute],
  ['change-password', registerChangePasswordRoute],
  ['forgot-password', registerForgotPasswordRoute],
  ['me', registerMeRoute],
  ['edit-me', registerEditMeRoute],
  ['delete-me', registerDeleteMeRoute],
  ['change-email', registerEmailChangeRoute],
  ['login-otp-verify', registerLoginOtpVerifyRoute],
  ['registration-otp-verify', registerRegistrationOtpVerifyRoute],
  ['forgot-password-otp-verify', registerForgotPasswordOtpVerifyRoute],
  ['login-resend-otp', registerLoginResendOtpRoute],
  ['registration-resend-otp', registerRegistrationResendOtpRoute],
  ['forgot-password-resend-otp', registerForgotPasswordResendOtpRoute],
];

describe('auth route registration guards', () => {
  test.each(registrars)(
    '%s does not register when authentication is disabled',
    async (_, register) => {
      const config = resolveConfig(
        {
          application: {name: 'Guard Test'},
          data: {models: {}},
          authentication: {enabled: false},
        },
        {mode: 'dev'},
      );

      const app = Fastify();
      register(app, config);
      await app.ready();

      expect(app.hasRoute({method: 'GET', url: '/v1/auth/user/me'})).toBe(
        false,
      );
      expect(app.printRoutes()).not.toContain('/auth/');

      await app.close();
    },
  );

  test('stops early when the auth model is missing', async () => {
    const config = resolveConfig(
      {
        application: {name: 'Guard Test'},
        data: {models: {}},
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'email',
                passwordField: 'password',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      {mode: 'dev'},
    );

    const app = Fastify();
    registerLoginRoute(app, config);
    await app.ready();

    expect(app.printRoutes()).not.toContain('/auth/');

    await app.close();
  });
});
