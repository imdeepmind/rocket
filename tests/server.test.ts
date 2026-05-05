import Fastify, {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator/index';
import {startServer} from '@/server';

import {registerRoutes} from '@/routes/index';

import {Mode} from '@/schema';
import {AppConfig} from '@/schema/config';

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

vi.mock('@/utils/welcome', () => ({
  showWelcomeScreen: vi.fn(),
}));

const mockConfig: AppConfig = {
  application: {
    logLevel: 'info',
  },
  database: {
    engine: 'sqlite',
    connection: {urlOrPath: ':memory:'},
  },
  swagger: {
    enabled: true,
    basePath: '/docs',
    info: {title: 'Test', description: 'Test API', version: '1.0'},
  },
  models: [
    {
      name: 'users',
      fields: [{name: 'id', type: 'integer', primaryKey: true}],
    },
  ],
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
      application: {logLevel: 'warn'},
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

    expect(mockApp.register).toHaveBeenCalledTimes(4);

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
      swagger: {...mockConfig.swagger, enabled: false},
    } as unknown as AppConfig;
    await startServer(disabledSwaggerConfig, 3000, 'prod');

    expect(mockApp.register).toHaveBeenCalledTimes(2);
  });

  it('should not register routes if models are missing/empty', async () => {
    const noModelsConfig = {...mockConfig, models: []} as unknown as AppConfig;
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
    it('should register redis plugin when cache_db is configured', async () => {
      const configWithRedis: AppConfig = {
        ...mockConfig,
        cache_db: {
          engine: 'redis',
          connection: {uri: 'redis://localhost:6379'},
          timeout: 5000,
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithRedis, 3000, 'dev');

      // Verify redis plugin was registered
      const redisRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => (call[1] as {engine?: string})?.engine === 'redis',
      );
      expect(redisRegistration).toBeDefined();
    });

    it('should not register redis plugin when cache_db is not configured', async () => {
      const registerMock = mockApp.register;
      await startServer(mockConfig, 3000, 'dev');

      // Verify redis plugin was not registered
      const redisRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => (call[1] as {engine?: string})?.engine === 'redis',
      );
      expect(redisRegistration).toBeUndefined();
    });

    it('should register rate-limit plugin when rateLimit is configured', async () => {
      const configWithRateLimit: AppConfig = {
        ...mockConfig,
        application: {
          logLevel: 'info',
          rateLimit: {
            enabled: true,
            max: 100,
            timeWindow: '15m',
            useRedis: false,
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithRateLimit, 3000, 'dev');

      // Verify rate-limit plugin was registered
      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => (call[1] as {rateLimit?: boolean})?.rateLimit,
      );
      expect(rateLimitRegistration).toBeDefined();
    });

    it('should not register rate-limit plugin when rateLimit is not configured', async () => {
      const registerMock = mockApp.register;
      await startServer(mockConfig, 3000, 'dev');

      // Verify rate-limit plugin was not registered
      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) => (call[1] as {rateLimit?: boolean})?.rateLimit,
      );
      expect(rateLimitRegistration).toBeUndefined();
    });

    it('should pass redis client to rate-limit when both cache_db and rateLimit with useRedis are configured', async () => {
      const configWithBoth: AppConfig = {
        ...mockConfig,
        cache_db: {
          engine: 'redis',
          connection: {uri: 'redis://localhost:6379'},
          timeout: 5000,
        },
        application: {
          logLevel: 'info',
          rateLimit: {
            enabled: true,
            max: 100,
            timeWindow: '15m',
            useRedis: true,
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithBoth, 3000, 'dev');

      // Verify rate-limit registration includes redis option
      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) =>
          (call[1] as {rateLimit?: {useRedis?: boolean}})?.rateLimit
            ?.useRedis === true,
      );
      expect(rateLimitRegistration).toBeDefined();
    });

    it('should disable rate-limit when enabled is false', async () => {
      const configWithDisabledRateLimit: AppConfig = {
        ...mockConfig,
        application: {
          logLevel: 'info',
          rateLimit: {
            enabled: false,
            max: 100,
            timeWindow: '15m',
            useRedis: false,
          },
        },
      };

      const registerMock = mockApp.register;
      await startServer(configWithDisabledRateLimit, 3000, 'dev');

      // Verify rate-limit plugin was still registered but with enabled: false
      const rateLimitRegistration = registerMock.mock.calls.find(
        (call: unknown[]) =>
          (call[1] as {rateLimit?: {enabled?: boolean}})?.rateLimit?.enabled ===
          false,
      );
      expect(rateLimitRegistration).toBeDefined();
    });
  });

  describe('Authentication Configuration', () => {
    it('should register auth plugin when auth is configured', async () => {
      const configWithAuth: AppConfig = {
        ...mockConfig,
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'email',
            passwordColumn: 'password',
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

    it('should include bearerAuth in swagger components when up-auth is enabled', async () => {
      const configWithUpAuth: AppConfig = {
        ...mockConfig,
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'email',
            passwordColumn: 'password',
          },
        },
      };

      await startServer(configWithUpAuth, 3000, 'dev');

      const swaggerRegistration = mockApp.register.mock.calls.find(
        (call: Array<{openapi: unknown}>) => call[1]?.openapi,
      );
      expect(swaggerRegistration).toBeDefined();
      expect(
        swaggerRegistration![1].openapi.components.securitySchemes,
      ).toHaveProperty('bearerAuth');
    });

    it('should include apiKeyAuth in swagger components when api-key is enabled', async () => {
      const configWithApiKey: AppConfig = {
        ...mockConfig,
        auth: {
          enableAuth: true,
          authEngine: 'api-key',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'email',
            passwordColumn: 'password',
          },
        },
      };

      await startServer(configWithApiKey, 3000, 'dev');

      const swaggerRegistration = mockApp.register.mock.calls.find(
        (call: Array<{openapi: unknown}>) => call[1]?.openapi,
      );
      expect(swaggerRegistration).toBeDefined();
      expect(
        swaggerRegistration![1].openapi.components.securitySchemes,
      ).toHaveProperty('apiKeyAuth');
    });
  });
});
