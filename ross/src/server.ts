import Fastify, {FastifyInstance} from 'fastify';

import authPlugin from '@/plugin/auth';
import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import corsPlugin from '@/plugin/cors';
import dbPlugin from '@/plugin/database';
import otpPlugin from '@/plugin/otp';
import rateLimitPlugin from '@/plugin/rate-limit';
import responsePlugin from '@/plugin/response';
import sspPlugin from '@/plugin/ssp';
import swaggerPlugin from '@/plugin/swagger';
import webhookPlugin from '@/plugin/webhook';

import {getSsoProviders, getUpAuth} from '@/lib/auth/up-auth';
import {isDistributedCacheConfigured} from '@/lib/cache';
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
import {registerLogoutRoute} from '@/routes/auth/logout';
import {registerMeRoute} from '@/routes/auth/me';
import {
  registerForgotPasswordOtpVerifyRoute,
  registerLoginOtpVerifyRoute,
  registerRegistrationOtpVerifyRoute,
} from '@/routes/auth/otp-verify';
import {registerProvidersRoute} from '@/routes/auth/providers';
import {registerRefreshRoute} from '@/routes/auth/refresh';
import {registerRegistrationRoute} from '@/routes/auth/registration';
import {
  registerForgotPasswordResendOtpRoute,
  registerLoginResendOtpRoute,
  registerRegistrationResendOtpRoute,
} from '@/routes/auth/resend-otp';
import {registerSsoRoutes} from '@/routes/auth/sso';
import {registerHealthRoute} from '@/routes/health';

import {ResolvedAppConfig} from '@/interfaces/config';

import {NODE_CACHE_OTP_WARNING, NODE_CACHE_SESSION_WARNING} from '@/constants';

export interface StartServerResult {
  app: FastifyInstance;
  routes: RouteInfo[];
}

export async function startServer(
  resolvedConfig: ResolvedAppConfig,
): Promise<StartServerResult> {
  const routes: RouteInfo[] = [];

  const app: FastifyInstance = Fastify({
    logger: {
      level: resolvedConfig.application.logLevel,
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

  const upAuth = getUpAuth(resolvedConfig);
  const ssoProviders = getSsoProviders(resolvedConfig);
  const usesAccountOtp = Boolean(
    upAuth && (upAuth.mfaRequired || upAuth.isVerifiedField),
  );
  const usesCacheSessionStorage = Boolean(
    resolvedConfig.authentication.enabled &&
    resolvedConfig.authentication.userModel &&
    resolvedConfig.authentication.sessionStorage === 'cache',
  );

  if (usesAccountOtp && !isDistributedCacheConfigured(resolvedConfig)) {
    app.addHook('onListen', () => {
      app.log.warn(NODE_CACHE_OTP_WARNING);
    });
  }

  if (
    usesCacheSessionStorage &&
    !isDistributedCacheConfigured(resolvedConfig)
  ) {
    app.addHook('onListen', () => {
      app.log.warn(NODE_CACHE_SESSION_WARNING);
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
  // config-driven OTP (required for MFA, verification and forgot-password)
  if (upAuth && resolvedConfig.integrations?.email) {
    await app.register(otpPlugin);
  }
  // register swagger
  if (resolvedConfig.docs.openapi.enabled) {
    await app.register(swaggerPlugin);
  }

  // register health check route
  registerHealthRoute(app, resolvedConfig);

  // register all config-driven routes under /api prefix (swagger excluded)
  await app.register(
    async app => {
      // Must run in preHandler: auth (route-level preValidation) has populated
      // request.user, and AJV validation has finished, so injected values are
      // neither resolved against an empty user nor stripped as unknown keys.
      app.addHook('preHandler', async request => {
        app.enforceSSP(request);
      });

      registerRoutes(app, resolvedConfig);

      // register auth routes: discovery and SSO are capability-driven, the
      // password routes exist only when an up-auth provider is configured.
      const hasUserModel =
        resolvedConfig.authentication.enabled &&
        Boolean(resolvedConfig.authentication.userModel);

      if (hasUserModel) {
        registerProvidersRoute(app, resolvedConfig);
        registerMeRoute(app, resolvedConfig);
        registerDeleteMeRoute(app, resolvedConfig);
        registerEditMeRoute(app, resolvedConfig);
        registerRefreshRoute(app, resolvedConfig);
        registerLogoutRoute(app, resolvedConfig);
      }

      if (resolvedConfig.authentication.enabled && ssoProviders.length > 0) {
        registerSsoRoutes(app, resolvedConfig);
      }

      if (upAuth) {
        registerRegistrationRoute(app, resolvedConfig);
        registerLoginRoute(app, resolvedConfig);
        registerChangePasswordRoute(app, resolvedConfig);

        if (resolvedConfig.integrations?.email) {
          registerForgotPasswordRoute(app, resolvedConfig);
          registerForgotPasswordOtpVerifyRoute(app, resolvedConfig);
          registerForgotPasswordResendOtpRoute(app, resolvedConfig);
        }

        if (upAuth.mfaRequired) {
          registerLoginOtpVerifyRoute(app, resolvedConfig);
          registerLoginResendOtpRoute(app, resolvedConfig);
        }

        if (upAuth.isVerifiedField) {
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
