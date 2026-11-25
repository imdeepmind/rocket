import Fastify from 'fastify';
import authPlugin from './plugin/auth.js';
import cachePlugin from './plugin/cache.js';
import communicatePlugin from './plugin/communicate.js';
import corsPlugin from './plugin/cors.js';
import dbPlugin from './plugin/database.js';
import otpPlugin from './plugin/otp.js';
import rateLimitPlugin from './plugin/rate-limit.js';
import responsePlugin from './plugin/response.js';
import sspPlugin from './plugin/ssp.js';
import swaggerPlugin from './plugin/swagger.js';
import webhookPlugin from './plugin/webhook.js';
import { getSsoProviders, getUpAuth } from './lib/auth/up-auth.js';
import { isDistributedCacheConfigured } from './lib/cache/index.js';
import { registerErrorHandler, registerNotFoundHandler, } from './lib/server/error-handler.js';
import { registerRoutes } from './routes/index.js';
import { registerEmailChangeRoute } from './routes/auth/change-email.js';
import { registerChangePasswordRoute } from './routes/auth/change-password.js';
import { registerDeleteMeRoute } from './routes/auth/delete-me.js';
import { registerEditMeRoute } from './routes/auth/edit-me.js';
import { registerForgotPasswordRoute } from './routes/auth/forgot-password.js';
import { registerLoginRoute } from './routes/auth/login.js';
import { registerMeRoute } from './routes/auth/me.js';
import { registerForgotPasswordOtpVerifyRoute, registerLoginOtpVerifyRoute, registerRegistrationOtpVerifyRoute, } from './routes/auth/otp-verify.js';
import { registerProvidersRoute } from './routes/auth/providers.js';
import { registerRegistrationRoute } from './routes/auth/registration.js';
import { registerForgotPasswordResendOtpRoute, registerLoginResendOtpRoute, registerRegistrationResendOtpRoute, } from './routes/auth/resend-otp.js';
import { registerSsoRoutes } from './routes/auth/sso.js';
import { registerHealthRoute } from './routes/health.js';
import { NODE_CACHE_OTP_WARNING } from './constants.js';
export async function startServer(resolvedConfig) {
    const routes = [];
    const app = Fastify({
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
    const usesAccountOtp = Boolean(upAuth && (upAuth.mfaRequired || upAuth.isVerifiedField));
    if (usesAccountOtp && !isDistributedCacheConfigured(resolvedConfig)) {
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
            apiIdentifier: routeOptions.config
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
    await app.register(async (app) => {
        // Must run in preHandler: auth (route-level preValidation) has populated
        // request.user, and AJV validation has finished, so injected values are
        // neither resolved against an empty user nor stripped as unknown keys.
        app.addHook('preHandler', async (request) => {
            app.enforceSSP(request);
        });
        registerRoutes(app, resolvedConfig);
        // register auth routes: discovery and SSO are capability-driven, the
        // password routes exist only when an up-auth provider is configured.
        const hasUserModel = resolvedConfig.authentication.enabled &&
            Boolean(resolvedConfig.authentication.userModel);
        if (hasUserModel) {
            registerProvidersRoute(app, resolvedConfig);
            registerMeRoute(app, resolvedConfig);
            registerDeleteMeRoute(app, resolvedConfig);
            registerEditMeRoute(app, resolvedConfig);
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
    }, { prefix: '/api' });
    return { app, routes };
}
//# sourceMappingURL=server.js.map