import Fastify, {FastifyInstance} from 'fastify';

import migrateDatabase from '@/migrator';
import authPlugin from '@/plugin/auth';
import cachePlugin, {
  isRedisCacheConfigured,
  NODE_CACHE_OTP_WARNING,
} from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import corsPlugin from '@/plugin/cors';
import dbPlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import rateLimitPlugin from '@/plugin/rate-limit';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import swaggerPlugin from '@/plugin/swagger';
import webhookPlugin from '@/plugin/webhook';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
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
import {AppConfigInput, UpAuthProviderConfig} from '@/interfaces/config';

export interface StartServerResult {
  app: FastifyInstance;
  routes: RouteInfo[];
}

export async function startServer(
  config: AppConfigInput,
  port: number,
  mode: Mode,
  verbose: boolean = false,
  migrate: boolean = false,
): Promise<StartServerResult> {
  // resolve env vars, defaults, and validate in a single pipeline
  const resolvedConfig = resolveAndValidateConfig(config, mode);

  const routes: RouteInfo[] = [];

  const app: FastifyInstance = Fastify({
    logger: {
      level: verbose ? 'debug' : resolvedConfig.application.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  app.appConfig = resolvedConfig;

  const auth =
    resolvedConfig.authentication.enabled &&
    resolvedConfig.authentication.provider?.type === 'up-auth'
      ? (resolvedConfig.authentication.provider.config as UpAuthProviderConfig)
      : undefined;
  const usesAccountOtp = Boolean(
    auth?.mfaRequired || auth?.userModel?.isVerifiedField,
  );

  if (usesAccountOtp && !isRedisCacheConfigured(resolvedConfig)) {
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
  if (resolvedConfig.integrations?.email) {
    await app.register(communicatePlugin);
  }

  // config-driven rate limit
  if (resolvedConfig.application.rateLimit.enabled) {
    await app.register(rateLimitPlugin);
  }

  // config-driven cors
  if (resolvedConfig.application.cors.enabled) {
    await app.register(corsPlugin);
  }

  await app.register(responsePlugin);
  await app.register(sspPlugin);
  await app.register(webhookPlugin);
  await app.register(authPlugin);
  // config-driven OTP (required for MFA or forgot-password)
  if (
    resolvedConfig.authentication.enabled &&
    auth?.mfaRequired !== undefined &&
    resolvedConfig.integrations?.email
  ) {
    await app.register(otpPlugin);
  }
  // register swagger
  if (resolvedConfig.docs.openapi.enabled) {
    await app.register(swaggerPlugin);
  }

  // migrate the db based on config
  if (migrate) {
    await migrateDatabase(resolvedConfig);
  }

  // register all config-driven routes under /api prefix (swagger excluded)
  await app.register(
    async app => {
      app.addHook('preValidation', async request => {
        app.enforceSSP(request);
      });

      registerRoutes(app, resolvedConfig);

      // register auth routes (only when up-auth is configured and enabled)
      if (
        resolvedConfig.authentication.enabled &&
        resolvedConfig.authentication.provider.type === 'up-auth'
      ) {
        const upConfig = resolvedConfig.authentication.provider
          .config as UpAuthProviderConfig;

        registerRegistrationRoute(app, resolvedConfig);
        registerLoginRoute(app, resolvedConfig);
        registerChangePasswordRoute(app, resolvedConfig);
        registerMeRoute(app, resolvedConfig);
        registerDeleteMeRoute(app, resolvedConfig);
        registerEditMeRoute(app, resolvedConfig);

        if (resolvedConfig.integrations?.email) {
          registerForgotPasswordRoute(app, resolvedConfig);
          registerForgotPasswordOtpVerifyRoute(app, resolvedConfig);
          registerForgotPasswordResendOtpRoute(app, resolvedConfig);
        }

        if (upConfig.mfaRequired) {
          registerLoginOtpVerifyRoute(app, resolvedConfig);
          registerLoginResendOtpRoute(app, resolvedConfig);
        }

        if (upConfig.userModel.isVerifiedField) {
          registerRegistrationOtpVerifyRoute(app, resolvedConfig);
          registerRegistrationResendOtpRoute(app, resolvedConfig);
          registerEmailChangeRoute(app, resolvedConfig);
        }
      }
    },
    {prefix: '/api'},
  );

  return {app, routes};
}
