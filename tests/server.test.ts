import Fastify, {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator/index';
import {startServer} from '@/server';

import {registerModelRoutes} from '@/routes/index';

import {AppConfig} from '@/schema/config';

import {showWelcomeScreen} from '@/utils/welcome';

vi.mock('fastify', () => {
  const mockApp = {
    register: vi.fn(),
    addHook: vi.fn(),
    setErrorHandler: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
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
  registerModelRoutes: vi.fn(),
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

  const runStart = async (mode: 'dev' | 'prod' = 'dev') => {
    await startServer(mockConfig, 3000, mode);
  };

  it('should initialize fastify with correct logger based on mode', async () => {
    const fastifyMock = vi.mocked(Fastify);
    await startServer(mockConfig, 3000, 'dev');

    expect(fastifyMock).toHaveBeenCalledWith({
      logger: {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
    });

    fastifyMock.mockClear();

    await startServer(mockConfig, 3000, 'prod');
    expect(fastifyMock).toHaveBeenCalledWith({
      logger: {
        level: mockConfig.application.logLevel,
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
    });
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
        logger: expect.objectContaining({level: 'debug'}),
      }),
    );
  });

  it('should register routes hook correctly', async () => {
    await runStart();
    const addHookMock = mockApp.addHook;
    expect(addHookMock).toHaveBeenCalledWith('onRoute', expect.any(Function));

    const hookCallback = addHookMock.mock.calls[0][1] as (opts: {
      method: string | string[];
      url: string;
    }) => void;

    hookCallback({method: 'GET', url: '/test'});
    hookCallback({method: ['POST', 'PUT'], url: '/multi'});

    const showWelcomeMock = vi.mocked(showWelcomeScreen);

    expect(showWelcomeMock).toHaveBeenCalledWith(
      mockConfig,
      3000,
      expect.arrayContaining([
        {method: 'GET', url: '/test'},
        {method: 'POST/PUT', url: '/multi'},
      ]),
    );
  });

  it('should register plugins and routes', async () => {
    await runStart();

    expect(mockApp.register).toHaveBeenCalledTimes(4);

    expect(migrateDatabase).toHaveBeenCalledWith(mockConfig);
    expect(registerModelRoutes).toHaveBeenCalledWith(
      mockApp,
      mockConfig.models,
    );
    expect(showWelcomeScreen).toHaveBeenCalled();
    expect(mockApp.listen).toHaveBeenCalledWith({port: 3000, host: '0.0.0.0'});
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

    expect(registerModelRoutes).not.toHaveBeenCalled();
  });

  it('should handle app.listen failure and process.exit context', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null,
      ) => never);
    const mockErr = new Error('port in use');
    mockApp.listen.mockRejectedValueOnce(mockErr);

    await runStart();

    expect(mockApp.log.error).toHaveBeenCalledWith(mockErr);
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
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
  });

  it('should return the app instance', async () => {
    const app = await startServer(mockConfig, 3000, 'dev');
    expect(app).toBe(mockApp);
  });
});
