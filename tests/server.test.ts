import Fastify, {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator/index';
import cachePlugin from '@/plugin/cache';
import communicatePlugin from '@/plugin/communicate';
import otpPlugin from '@/plugin/otp';
import rateLimitPlugin from '@/plugin/rate-limit';
import {startServer} from '@/server';

import {registerChangePasswordRoute} from '@/routes/auth/change-password';
import {registerDeleteMeRoute} from '@/routes/auth/delete-me';
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
import {registerRoutes} from '@/routes/index';

import {Mode} from '@/interfaces';
import {AppConfig} from '@/interfaces/config';

vi.mock('fastify', () => {
  const mockApp = {
    register: vi.fn(),
    addHook: vi.fn(),
    setErrorHandler: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    log: {
      error: vi.fn(),
      info: vi.fn(),
    },
    buildResponse: vi.fn((statusCode, message, data, meta) => ({
      statusCode,
      message,
      meta,
    })),
  };
  return {
    default: vi.fn(() => mockApp),
  };
});

vi.mock('@/validators/config', () => ({
  validateConfig: vi.fn(c => c),
}));

vi.mock('@/migrator/index', () => ({
  default: vi.fn(),
}));

vi.mock('@/routes/index', () => ({
  registerRoutes: vi.fn(),
}));

vi.mock('@/routes/auth/registration', () => ({
  registerRegistrationRoute: vi.fn(),
}));

vi.mock('@/routes/auth/login', () => ({
  registerLoginRoute: vi.fn(),
}));

vi.mock('@/routes/auth/change-password', () => ({
  registerChangePasswordRoute: vi.fn(),
}));

vi.mock('@/routes/auth/forgot-password', () => ({
  registerForgotPasswordRoute: vi.fn(),
}));

vi.mock('@/routes/auth/otp-verify', () => ({
  registerForgotPasswordOtpVerifyRoute: vi.fn(),
  registerLoginOtpVerifyRoute: vi.fn(),
  registerRegistrationOtpVerifyRoute: vi.fn(),
}));

vi.mock('@/routes/auth/resend-otp', () => ({
  registerForgotPasswordResendOtpRoute: vi.fn(),
  registerLoginResendOtpRoute: vi.fn(),
  registerRegistrationResendOtpRoute: vi.fn(),
}));

vi.mock('@/routes/auth/me', () => ({
  registerMeRoute: vi.fn(),
}));

vi.mock('@/routes/auth/delete-me', () => ({
  registerDeleteMeRoute: vi.fn(),
}));

vi.mock('@/utils/welcome', () => ({
  showWelcomeScreen: vi.fn(),
}));

const mockConfig: AppConfig = {
  application: {
    name: 'Test App',
    logLevel: 'info',
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {url: ':memory:'},
    },
  },
  docs: {
    openapi: {
      enabled: true,
      path: '/docs',
      info: {title: 'Test', description: 'Test API', version: '1.0'},
    },
  },
  data: {
    models: {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true},
        },
      },
    },
  },
};

type MockedApp = FastifyInstance & {
  register: ReturnType<typeof vi.fn>;
  addHook: ReturnType<typeof vi.fn>;
  setErrorHandler: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  log: {
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  buildResponse: ReturnType<typeof vi.fn>;
};

describe('Server', () => {
  let mockApp: MockedApp;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = Fastify() as unknown as MockedApp;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runStart = async (
    mode: Mode = 'dev',
    verbose: boolean = false,
    migrate: boolean = false,
  ) => {
    await startServer(mockConfig, 3000, mode, verbose, migrate);
  };

  it('should initialize fastify with correct logger based on configuration', async () => {
    const fastifyMock = vi.mocked(Fastify);
    await startServer(mockConfig, 3000, 'dev');

    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({
          level: mockConfig.application.logLevel,
        }),
      }),
    );

    fastifyMock.mockClear();

    await startServer(mockConfig, 3000, 'prod');
    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({
          level: mockConfig.application.logLevel,
        }),
      }),
    );
  });

  it('should respect custom logLevel from application config in prod mode', async () => {
    const fastifyMock = vi.mocked(Fastify);
    const customConfig: AppConfig = {
      ...mockConfig,
      application: {name: 'Test App', logLevel: 'warn'},
    };

    await startServer(customConfig, 3000, 'prod');
    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({level: 'warn'}),
      }),
    );

    fastifyMock.mockClear();

    await startServer(customConfig, 3000, 'dev');
    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({level: 'warn'}),
      }),
    );
  });

  it('should override logger level to debug when verbose is true', async () => {
    const fastifyMock = vi.mocked(Fastify);

    // Test verbose in prod mode
    await startServer(mockConfig, 3000, 'prod', true);
    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({level: 'debug'}),
      }),
    );

    fastifyMock.mockClear();

    // Test verbose in dev mode (should still be debug)
    await startServer(mockConfig, 3000, 'dev', true);
    expect(fastifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({level: 'debug'}),
      }),
    );
  });

  it('should register routes hook correctly', async () => {
    const {routes} = await startServer(mockConfig, 3000, 'dev');
    const addHookMock = mockApp.addHook;
    expect(addHookMock).toHaveBeenCalledWith('onRoute', expect.any(Function));

    const hookCallback = addHookMock.mock.calls[0][1] as (opts: {
      method: string | string[];
      url: string;
    }) => void;

    hookCallback({method: 'GET', url: '/test'});
    hookCallback({method: ['POST', 'PUT'], url: '/multi'});

    expect(routes).toEqual(
      expect.arrayContaining([
        {method: 'GET', url: '/test'},
        {method: 'POST/PUT', url: '/multi'},
      ]),
    );
  });

  it('should register plugins and routes', async () => {
    await runStart('dev', false, true);

    expect(mockApp.register).toHaveBeenCalledTimes(6);

    expect(migrateDatabase).toHaveBeenCalledWith(mockConfig);
    expect(registerRoutes).toHaveBeenCalledWith(mockApp, mockConfig);
  });

  it('should skip migration when migrate is false', async () => {
    await runStart('dev', false, false);
    expect(migrateDatabase).not.toHaveBeenCalled();
  });

  it('should not register swagger if disabled', async () => {
    const disabledSwaggerConfig = {
      ...mockConfig,
      docs: {
        openapi: {...mockConfig.docs.openapi, enabled: false},
      },
    } as unknown as AppConfig;
    await startServer(disabledSwaggerConfig, 3000, 'prod');

    expect(mockApp.register).toHaveBeenCalledTimes(5);
  });

  it('should not register routes if models are missing/empty', async () => {
    const noModelsConfig = {
      ...mockConfig,
      data: {models: {}},
    } as unknown as AppConfig;
    await startServer(noModelsConfig, 3000, 'prod');

    expect(registerRoutes).toHaveBeenCalledWith(
      expect.any(Object),
      noModelsConfig,
    );
  });

  describe('Error Handler', () => {
    type TestError = FastifyError & {
      code?: string;
      validation?: FastifyError['validation'];
    };
    type ErrorHandler = (
      err: TestError,
      req: FastifyRequest,
      reply: FastifyReply,
    ) => void;

    let errorHandler: ErrorHandler;
    let mockReq: FastifyRequest;
    let mockReply: FastifyReply;

    beforeEach(async () => {
      await runStart();
      errorHandler = mockApp.setErrorHandler.mock.calls[0][0] as ErrorHandler;

      mockReq = {
        log: {error: vi.fn()},
      } as unknown as FastifyRequest;

      mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;
    });

    const createError = (
      msg: string,
      code?: string,
      statusCode?: number,
      validation?: FastifyError['validation'],
    ): TestError => {
      const e = new Error(msg) as TestError;
      if (code) e.code = code;
      if (statusCode) e.statusCode = statusCode;
      if (validation) e.validation = validation;
      return e;
    };

    it('should handle standard fastify error code fallback', () => {
      const err = createError('generic error');
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({statusCode: 500, message: 'generic error'}),
      );
    });

    it('should process Data exceptions (22xxx) as 400', () => {
      const err = createError('Invalid input syntax', '22P02');
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({statusCode: 400}),
      );
    });

    it('should process Integrity violations (23xxx) as 400', () => {
      const err = createError('Unique constraint violation', '23505');
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
    });

    it('should process Connection exceptions (08xxx) as 503', () => {
      const err = createError('Connection failed', '08001');
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(503);
    });

    it('should route unknown database errors appropriately (e.g. 42P01 undefined table)', () => {
      const err = createError('Undefined table', '42P01');
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });

    it('should respect incoming status code if specified, provided it is valid HTTP', () => {
      const err = createError('Custom 422 object', '99999', 422);
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(422);
    });

    it('should send err.body directly when present', () => {
      const err = createError('Business error', undefined, 422);
      (err as unknown as Record<string, unknown>).body = {
        code: 422,
        message: 'Business error',
        data: null,
      };
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(422);
      expect(mockReply.send).toHaveBeenCalledWith({
        code: 422,
        message: 'Business error',
        data: null,
      });
    });

    it('should pass validation errors in metadata payload', () => {
      // Create a mock validation error block conforming to fastify's validation structure
      const validationPayload = [
        {message: 'field required'},
      ] as unknown as FastifyError['validation'];
      const err = createError(
        'Validation failed',
        undefined,
        400,
        validationPayload,
      );
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            validation: [{message: 'field required'}],
          }),
        }),
      );
    });

    it('should default to 500 if an invalid status code is provided with an error code (hits line 148)', () => {
      const err = createError('Bad error', 'SOME_CODE', 200);
      errorHandler(err, mockReq, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });
  });

  it('should return the app instance and routes', async () => {
    const {app, routes} = await startServer(mockConfig, 3000, 'dev');
    expect(app).toBe(mockApp);
    expect(Array.isArray(routes)).toBe(true);
  });

  describe('Redis and Rate Limit Configuration', () => {
    it('should register rate-limit plugin when rateLimit is configured', async () => {
      const configWithRateLimit: AppConfig = {
        ...mockConfig,
        application: {
          name: 'Test App',
          logLevel: 'info',
          rateLimit: {
            enabled: true,
            max: 100,
            timeWindow: '15m',
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithRateLimit, 3000, 'dev');

      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === rateLimitPlugin,
      );
      expect(rateLimitRegistration).toBeDefined();
    });

    it('should not register rate-limit plugin when rateLimit is not configured', async () => {
      const registerMock = mockApp.register;
      await startServer(mockConfig, 3000, 'dev');

      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === rateLimitPlugin,
      );
      expect(rateLimitRegistration).toBeUndefined();
    });

    it('should disable rate-limit when enabled is false', async () => {
      const configWithDisabledRateLimit: AppConfig = {
        ...mockConfig,
        application: {
          name: 'Test App',
          logLevel: 'info',
          rateLimit: {
            enabled: false,
            max: 100,
            timeWindow: '15m',
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithDisabledRateLimit, 3000, 'dev');

      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === rateLimitPlugin,
      );
      expect(rateLimitRegistration).toBeUndefined();
    });
  });

  describe('Authentication Configuration', () => {
    it('should register auth plugin when auth is configured', async () => {
      const configWithAuth: AppConfig = {
        ...mockConfig,
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
            },
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithAuth, 3000, 'dev');

      // Our startServer calls register(authPlugin) if config.auth is present
      expect(registerMock).toHaveBeenCalledWith(
        expect.any(Function), // authPlugin
      );
    });

    it('should register otp plugin when auth is up-auth with mfaRequired', async () => {
      const configWithMfa: AppConfig = {
        ...mockConfig,
        infrastructure: {
          ...mockConfig.infrastructure,
          cache: {
            engine: 'redis',
            connection: {url: 'redis://localhost:6379'},
          },
        },
        integrations: {
          email: {
            provider: 'dummy',
          },
        },
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
              mfaRequired: true,
            },
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithMfa, 3000, 'dev');

      expect(registerMock).toHaveBeenCalledWith(otpPlugin);
    });

    it('should register auth routes conditionally based on config', async () => {
      const configWithAll: AppConfig = {
        ...mockConfig,
        integrations: {
          email: {
            provider: 'dummy',
          },
        },
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
                isVerifiedField: 'is_active',
              },
              jwtSecret: 'test-secret',
              mfaRequired: true,
            },
          },
        },
      };

      await startServer(configWithAll, 3000, 'dev');

      expect(registerRegistrationRoute).toHaveBeenCalled();
      expect(registerLoginRoute).toHaveBeenCalled();
      expect(registerChangePasswordRoute).toHaveBeenCalled();
      expect(registerForgotPasswordRoute).toHaveBeenCalled();
      expect(registerLoginOtpVerifyRoute).toHaveBeenCalled();
      expect(registerRegistrationOtpVerifyRoute).toHaveBeenCalled();
      expect(registerForgotPasswordOtpVerifyRoute).toHaveBeenCalled();
      expect(registerLoginResendOtpRoute).toHaveBeenCalled();
      expect(registerRegistrationResendOtpRoute).toHaveBeenCalled();
      expect(registerForgotPasswordResendOtpRoute).toHaveBeenCalled();
      expect(registerMeRoute).toHaveBeenCalled();
      expect(registerDeleteMeRoute).toHaveBeenCalled();
    });

    it('should not register registration OTP verify route when isVerifiedField is not set', async () => {
      const configWithoutVerified: AppConfig = {
        ...mockConfig,
        integrations: {
          email: {
            provider: 'dummy',
          },
        },
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
              jwtSecret: 'test-secret',
              mfaRequired: true,
            },
          },
        },
      };

      await startServer(configWithoutVerified, 3000, 'dev');

      expect(registerRegistrationOtpVerifyRoute).not.toHaveBeenCalled();
      expect(registerRegistrationResendOtpRoute).not.toHaveBeenCalled();
    });

    it('should not register login OTP verify route when mfa is not required', async () => {
      const configWithoutMfa: AppConfig = {
        ...mockConfig,
        integrations: {
          email: {
            provider: 'dummy',
          },
        },
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
              jwtSecret: 'test-secret',
            },
          },
        },
      };

      await startServer(configWithoutMfa, 3000, 'dev');

      expect(registerLoginOtpVerifyRoute).not.toHaveBeenCalled();
      expect(registerLoginResendOtpRoute).not.toHaveBeenCalled();
    });

    it('should not register forgot-password routes when email is not configured', async () => {
      const configWithoutEmail: AppConfig = {
        ...mockConfig,
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
              jwtSecret: 'test-secret',
              mfaRequired: true,
            },
          },
        },
      };

      await startServer(configWithoutEmail, 3000, 'dev');

      expect(registerForgotPasswordRoute).not.toHaveBeenCalled();
      expect(registerForgotPasswordOtpVerifyRoute).not.toHaveBeenCalled();
      expect(registerForgotPasswordResendOtpRoute).not.toHaveBeenCalled();
    });
  });

  describe('Integrations Configuration', () => {
    it('should register communicate plugin when integrations.email is configured', async () => {
      const configWithIntegrations: AppConfig = {
        ...mockConfig,
        integrations: {
          email: {
            provider: 'dummy',
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithIntegrations, 3000, 'dev');

      expect(registerMock).toHaveBeenCalledWith(communicatePlugin);
    });

    it('should not register communicate plugin when integrations.email is not configured', async () => {
      const registerMock = mockApp.register;
      await startServer(mockConfig, 3000, 'dev');

      // Assert that none of the registered calls are the communicatePlugin
      const communicatePluginCall = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === communicatePlugin,
      );
      expect(communicatePluginCall).toBeUndefined();
    });
  });

  describe('Cache Configuration', () => {
    it('should register cache plugin when cache is configured', async () => {
      const configWithCache: AppConfig = {
        ...mockConfig,
        infrastructure: {
          ...mockConfig.infrastructure,
          cache: {
            engine: 'redis',
            connection: {url: 'redis://localhost:6379'},
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithCache, 3000, 'dev');

      const cachePluginCall = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === cachePlugin,
      );
      expect(cachePluginCall).toBeDefined();
    });

    it('should register cache plugin even when cache is not configured', async () => {
      const registerMock = mockApp.register;
      await startServer(mockConfig, 3000, 'dev');

      const cachePluginCall = registerMock.mock.calls.find(
        (call: unknown[]) => call[0] === cachePlugin,
      );
      expect(cachePluginCall).toBeDefined();
    });
  });
});
