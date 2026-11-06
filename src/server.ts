import Fastify, {FastifyInstance} from 'fastify';

import migrateDatabase from '@/migrator';
import authPlugin from '@/plugin/auth';
import cachePlugin, {
  isRedisCacheConfigured,
  NODE_CACHE_OTP_WARNING,
} from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import dbPlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import rateLimitPlugin from '@/plugin/rate-limit';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import swaggerPlugin from '@/plugin/swagger';
import webhookPlugin from '@/plugin/webhook';

import {
  registerErrorHandler,
  registerNotFoundHandler,
} from '@/lib/server/error-handler';
import {RouteInfo} from '@/lib/server/welcome';

import {registerRoutes} from '@/routes';
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

import {Mode} from '@/interfaces';
import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';

export interface StartServerResult {
  app: FastifyInstance;
  routes: RouteInfo[];
}

export async function startServer(
  config: AppConfig,
  port: number,
  mode: Mode,
  verbose: boolean = false,
  migrate: boolean = false,
): Promise<StartServerResult> {
  // validate the schema
  config = validateConfig(config);

  const routes: RouteInfo[] = [];

  const app: FastifyInstance = Fastify({
    logger: {
      level: verbose ? 'debug' : config.application.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  app.appConfig = config;

  const upAuthConfig =
    config.authentication?.provider.type === 'up-auth'
      ? (config.authentication.provider.config as UpAuthProviderConfig)
      : undefined;
  const usesAccountOtp = Boolean(
    upAuthConfig?.mfaRequired || upAuthConfig?.userModel?.isVerifiedField,
  );

  if (usesAccountOtp && !isRedisCacheConfigured(config)) {
    app.addHook('onListen', () => {
      app.log.warn(NODE_CACHE_OTP_WARNING);
    });
  }

  // Must be installed before routes are registered, otherwise Fastify keeps
  // the default error handler for those routes.
  registerErrorHandler(app);
  registerNotFoundHandler(app);

  // Track each registered route
  app.addHook('onRoute', routeOptions => {
    routes.push({
      method: Array.isArray(routeOptions.method)
        ? routeOptions.method.join('/')
        : routeOptions.method,
      url: routeOptions.url,
      apiIdentifier: (routeOptions.config as {apiIdentifier?: string})
        ?.apiIdentifier,
    });
  });

  // config-driven DB
  await app.register(dbPlugin);

  // config-driven cache (Redis or NodeCache)
  await app.register(cachePlugin);

  // config-driven integrations (email)
  if (config.integrations?.email) {
    await app.register(communicatePlugin);
  }

  // config-driven rate limit
  if (config.application.rateLimit?.enabled) {
    await app.register(rateLimitPlugin);
  }

  await app.register(responsePlugin);
  await app.register(sspPlugin);
  await app.register(webhookPlugin);
  if (config.authentication) {
    await app.register(authPlugin);
  }
  // config-driven OTP (required for MFA or forgot-password)
  if (
    config.authentication?.provider.type === 'up-auth' &&
    ((config.authentication.provider.config as {mfaRequired?: boolean})
      ?.mfaRequired ||
      config.integrations?.email)
  ) {
    await app.register(otpPlugin);
  }
  // register swagger
  if (config.docs.openapi.enabled) {
    await app.register(swaggerPlugin);
  }

  // migrate the db based on config
  if (migrate) {
    await migrateDatabase(config);
  }

  // register all config-driven routes under /api prefix (swagger excluded)
  await app.register(
    async app => {
      app.addHook('preValidation', async request => {
        app.enforceSSP(request);
      });

      registerRoutes(app, config);

      // register auth routes (only when up-auth is configured and enabled)
      if (
        config.authentication?.enabled &&
        config.authentication?.provider?.type === 'up-auth'
      ) {
        const upConfig = config.authentication.provider
          .config as UpAuthProviderConfig;

        registerRegistrationRoute(app, config);
        registerLoginRoute(app, config);
        registerChangePasswordRoute(app, config);
        registerMeRoute(app, config);
        registerDeleteMeRoute(app, config);
        registerEditMeRoute(app, config);

        if (config.integrations?.email) {
          registerForgotPasswordRoute(app, config);
          registerForgotPasswordOtpVerifyRoute(app, config);
          registerForgotPasswordResendOtpRoute(app, config);
        }

        if (upConfig.mfaRequired) {
          registerLoginOtpVerifyRoute(app, config);
          registerLoginResendOtpRoute(app, config);
        }

        if (upConfig.userModel.isVerifiedField) {
          registerRegistrationOtpVerifyRoute(app, config);
          registerRegistrationResendOtpRoute(app, config);
          registerEmailChangeRoute(app, config);
        }
      }
    },
    {prefix: '/api'},
  );

  return {app, routes};
}
