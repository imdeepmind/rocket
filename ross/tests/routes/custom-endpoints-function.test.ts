import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';

import {registerCustomEndpointRoutes} from '@/routes/custom-endpoints/custom-endpoints';
import {
  buildFunctionEndpointSchema,
  clearFunctionModuleCache,
  handleFunction,
  resolveFunctionArtifactPath,
} from '@/routes/custom-endpoints/handlers/function';

import {
  AuthenticationConfig,
  CustomEndpointConfig,
  CustomEndpointFunctionHandler,
} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

describe('Custom Function Endpoints Runtime & Execution', () => {
  let tempDir: string;
  let tempFunctionsDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-functions-test-'));
    tempFunctionsDir = path.join(tempDir, '.ross', 'functions');
    fs.mkdirSync(tempFunctionsDir, {recursive: true});
    process.env.ROSS_FUNCTIONS_DIR = tempFunctionsDir;
  });

  afterAll(() => {
    delete process.env.ROSS_FUNCTIONS_DIR;
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearFunctionModuleCache();
  });

  describe('buildFunctionEndpointSchema', () => {
    it('returns empty schema when inputs are not provided', () => {
      const handler: CustomEndpointFunctionHandler = {
        type: 'function',
        file: './function/test.ts',
        exportName: 'testHandler',
      };

      const result = buildFunctionEndpointSchema(handler, {
        type: 'object',
        properties: {id: {type: 'integer'}},
      });

      expect(result).toEqual({});
    });

    it('slices path params and marks all path keys as required', () => {
      const handler: CustomEndpointFunctionHandler = {
        type: 'function',
        file: './function/test.ts',
        exportName: 'testHandler',
        inputs: {
          path: ['id'],
        },
      };

      const validation = {
        type: 'object',
        properties: {
          id: {type: 'integer', minimum: 1},
        },
      };

      const result = buildFunctionEndpointSchema(handler, validation);

      expect(result.params).toEqual({
        type: 'object',
        properties: {
          id: {type: 'integer', minimum: 1},
        },
        required: ['id'],
        additionalProperties: false,
      });
      expect(result.querystring).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('slices querystring, body, and headers, filtering required fields', () => {
      const handler: CustomEndpointFunctionHandler = {
        type: 'function',
        file: './function/test.ts',
        exportName: 'testHandler',
        inputs: {
          query: ['filter', 'optionalSort'],
          body: ['name', 'description'],
          headers: ['x-api-key', 'x-optional-trace'],
        },
      };

      const validation = {
        type: 'object',
        required: ['filter', 'name', 'x-api-key'],
        properties: {
          filter: {type: 'string'},
          optionalSort: {type: 'string'},
          name: {type: 'string'},
          description: {type: 'string'},
          'x-api-key': {type: 'string'},
          'x-optional-trace': {type: 'string'},
        },
      };

      const result = buildFunctionEndpointSchema(handler, validation);

      expect(result.querystring).toEqual({
        type: 'object',
        properties: {
          filter: {type: 'string'},
          optionalSort: {type: 'string'},
        },
        required: ['filter'],
        additionalProperties: false,
      });

      expect(result.body).toEqual({
        type: 'object',
        properties: {
          name: {type: 'string'},
          description: {type: 'string'},
        },
        required: ['name'],
        additionalProperties: false,
      });

      expect(result.headers).toEqual({
        type: 'object',
        properties: {
          'x-api-key': {type: 'string'},
          'x-optional-trace': {type: 'string'},
        },
        required: ['x-api-key'],
      });
    });

    it('handles query or body when no fields in required list match', () => {
      const handler: CustomEndpointFunctionHandler = {
        type: 'function',
        file: './function/test.ts',
        exportName: 'testHandler',
        inputs: {
          query: ['optQuery'],
          body: ['optBody'],
        },
      };

      const validation = {
        type: 'object',
        required: ['otherField'],
        properties: {
          optQuery: {type: 'string'},
          optBody: {type: 'string'},
        },
      };

      const result = buildFunctionEndpointSchema(handler, validation);

      expect(result.querystring).toEqual({
        type: 'object',
        properties: {optQuery: {type: 'string'}},
        additionalProperties: false,
      });
      expect(result.body).toEqual({
        type: 'object',
        properties: {optBody: {type: 'string'}},
        additionalProperties: false,
      });
    });

    it('handles missing validation.properties gracefully', () => {
      const handler: CustomEndpointFunctionHandler = {
        type: 'function',
        file: './function/test.ts',
        exportName: 'testHandler',
        inputs: {
          path: ['id'],
        },
      };

      const result = buildFunctionEndpointSchema(handler, undefined);
      expect(result.params).toEqual({
        type: 'object',
        properties: {},
        required: ['id'],
        additionalProperties: false,
      });
    });
  });

  describe('resolveFunctionArtifactPath', () => {
    it('resolves artifact destination stripping leading function directory', () => {
      const resolved = resolveFunctionArtifactPath(
        './function/users/getUser.ts',
        '/mock/app',
        '/mock/app/.ross/functions',
      );
      expect(resolved).toBe(
        path.resolve('/mock/app/.ross/functions', 'users', 'getUser.js'),
      );
    });

    it('uses process.env.ROSS_FUNCTIONS_DIR when outDir is not provided', () => {
      const resolved = resolveFunctionArtifactPath(
        './functions/posts/create.ts',
        tempDir,
      );
      expect(resolved).toBe(
        path.resolve(tempFunctionsDir, 'posts', 'create.js'),
      );
    });
  });

  describe('Fail-Fast Startup Guard', () => {
    it('throws actionable error when pre-compiled artifact is missing', () => {
      const app = {
        route: vi.fn(),
        buildResponse: vi.fn(),
      } as unknown as FastifyInstance;

      const baseConfig = resolveConfig(
        {
          application: {name: 'Test App'},
          infrastructure: {database: pgConfig},
          customEndpoints: {
            missingArtifact: {
              method: 'GET',
              path: '/missing',
              description: 'Missing artifact endpoint',
              handler: {
                type: 'function',
                file: './function/missing.ts',
                exportName: 'missingHandler',
              },
            },
          },
        },
        {mode: 'dev'},
      );

      expect(() =>
        registerCustomEndpointRoutes(app, baseConfig, {
          configDir: tempDir,
          outDir: tempFunctionsDir,
        }),
      ).toThrow(
        'Compiled function artifact missing for endpoint "missingArtifact". Run "ross build" first.',
      );
    });
  });

  describe('Runtime Execution with (request, app)', () => {
    let fastify: FastifyInstance;
    let customEndpoints: Record<string, CustomEndpointConfig>;

    const upAuthConfig: AuthenticationConfig = {
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
          jwtSecret: 'super-secret-test-jwt-key-minimum-32-chars-long',
        },
      },
    };

    beforeAll(async () => {
      // Create mock compiled JS files in tempFunctionsDir
      const usersBundlePath = path.join(
        tempFunctionsDir,
        'users',
        'profile.js',
      );
      fs.mkdirSync(path.dirname(usersBundlePath), {recursive: true});

      const bundleCode = `
        export async function getUserProfile(request, app) {
          const id = Number(request.params.id);
          const includeMeta = request.query.includeMeta === true || request.query.includeMeta === 'true';
          const { clientTag } = request.body;
          const customHeader = request.headers['x-custom-header'];

          // Test db access via app.db
          const dbRes = await app.db.query('SELECT * FROM users WHERE id = $1', [id]);

          // Test cache access via app.cache
          await app.cache.set('last_user', String(id), 60);
          const cachedVal = await app.cache.get('last_user');

          return {
            id,
            includeMeta,
            clientTag,
            customHeader,
            dbRowCount: dbRes.rows.length,
            cachedVal,
            hasDb: typeof app.db.query === 'function',
            hasCache: typeof app.cache.get === 'function',
            hasConfig: Boolean(app.appConfig),
            hasLog: typeof request.log.info === 'function',
            userAgent: request.headers['user-agent'],
            user: request.user ?? null,
          };
        }

        export async function returnNullHandler() {
          return null;
        }

        export async function returnUndefinedHandler() {
          return undefined;
        }

        export async function notFoundHandler() {
          const err = new Error('Resource not found');
          err.statusCode = 404;
          throw err;
        }

        export async function badRequestHandler() {
          const err = new Error('Invalid query input');
          err.statusCode = 400;
          throw err;
        }

        export async function internalErrorHandler() {
          throw new Error('Unexpected crash in user code');
        }

        export const notAFunction = 12345;
      `;

      fs.writeFileSync(usersBundlePath, bundleCode, 'utf-8');

      customEndpoints = {
        getUserProfile: {
          method: 'POST',
          path: '/users/:id/profile',
          description: 'Get user profile with full context',
          validation: {
            type: 'object',
            required: ['id', 'clientTag'],
            properties: {
              id: {type: 'integer', minimum: 1},
              includeMeta: {type: 'boolean', default: false},
              clientTag: {type: 'string'},
              'x-custom-header': {type: 'string'},
            },
          },
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'getUserProfile',
            inputs: {
              path: ['id'],
              query: ['includeMeta'],
              body: ['clientTag'],
              headers: ['x-custom-header'],
            },
          },
        },
        returnNull: {
          method: 'GET',
          path: '/return-null',
          description: 'Returns null',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'returnNullHandler',
          },
        },
        returnUndefined: {
          method: 'GET',
          path: '/return-undefined',
          description: 'Returns undefined',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'returnUndefinedHandler',
          },
        },
        notFound: {
          method: 'GET',
          path: '/not-found',
          description: 'Throws 404 error',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'notFoundHandler',
          },
        },
        badRequest: {
          method: 'GET',
          path: '/bad-request',
          description: 'Throws 400 error',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'badRequestHandler',
          },
        },
        internalError: {
          method: 'GET',
          path: '/internal-error',
          description: 'Throws 500 error',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'internalErrorHandler',
          },
        },
        missingExport: {
          method: 'GET',
          path: '/missing-export',
          description: 'Export not found',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'nonExistentExport',
          },
        },
        notAFunctionExport: {
          method: 'GET',
          path: '/not-a-function',
          description: 'Export is not a function',
          handler: {
            type: 'function',
            file: './function/users/profile.ts',
            exportName: 'notAFunction',
          },
        },
      };

      fastify = await createTestApp(pgConfig, {}, undefined, customEndpoints);
    });

    afterAll(async () => {
      await fastify.close();
    });

    it('executes function handler with (request, app) and wraps response', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 42, name: 'Alice'}],
        rowCount: 1,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/custom-endpoints/users/42/profile',
        query: {
          includeMeta: 'true',
        },
        payload: {
          clientTag: 'mobile-app',
        },
        headers: {
          'user-agent': 'TestAgent/1.0',
          'x-custom-header': 'custom-val',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.code).toBe(200);
      expect(json.message).toBe('Success');

      expect(json.data).toMatchObject({
        id: 42,
        includeMeta: true,
        clientTag: 'mobile-app',
        customHeader: 'custom-val',
        dbRowCount: 1,
        cachedVal: '42',
        hasDb: true,
        hasCache: true,
        hasConfig: true,
        hasLog: true,
        userAgent: 'TestAgent/1.0',
        user: null,
      });
    });

    it('provides authenticated user on request.user when JWT is passed', async () => {
      const authApp = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
        upAuthConfig,
      );

      pgQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const token = authApp.jwt.sign({
        id: 'usr_123',
        email: 'user@example.com',
      });

      const response = await authApp.inject({
        method: 'POST',
        url: '/v1/custom-endpoints/users/99/profile',
        payload: {
          clientTag: 'web-dashboard',
        },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.user).toMatchObject({
        id: 'usr_123',
        email: 'user@example.com',
      });

      await authApp.close();
    });

    it('wraps null return value into data: null with code: 200', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/return-null',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        code: 200,
        message: 'Success',
        data: null,
      });
    });

    it('wraps undefined return value into data: null with code: 200', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/return-undefined',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        code: 200,
        message: 'Success',
        data: null,
      });
    });

    it('translates thrown error with statusCode: 404 to 404 response', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/not-found',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        code: 404,
        message: 'Resource not found',
        data: null,
      });
    });

    it('translates thrown error with statusCode: 400 to 400 response', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/bad-request',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        code: 400,
        message: 'Invalid query input',
        data: null,
      });
    });

    it('translates thrown error without statusCode to 500 response', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/internal-error',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        code: 500,
        message: 'Unexpected crash in user code',
        data: null,
      });
    });

    it('returns 400 when Fastify schema validation fails on input params', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/custom-endpoints/users/not-a-number/profile',
        payload: {
          clientTag: 'test',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.code).toBe(400);
      expect(json.message).toContain('params/id must be integer');
    });

    it('returns 500 when handler export does not exist in bundle', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/missing-export',
      });

      expect(response.statusCode).toBe(500);
      const json = JSON.parse(response.body);
      expect(json.code).toBe(500);
      expect(json.message).toContain('not exported as a function');
    });

    it('returns 500 when handler export is not a function', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/not-a-function',
      });

      expect(response.statusCode).toBe(500);
      const json = JSON.parse(response.body);
      expect(json.code).toBe(500);
      expect(json.message).toContain('not exported as a function');
    });
  });

  describe('handleFunction directly', () => {
    it('uses custom loader and caches loaded module', async () => {
      const mockApp = {
        db: {query: vi.fn()},
        cache: {get: vi.fn(), set: vi.fn()},
        appConfig: {},
        buildResponse: vi.fn((code, message, data) => ({code, message, data})),
      } as unknown as FastifyInstance;

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      const mockRequest = {
        params: {},
        query: {},
        body: {},
        headers: {},
        user: undefined,
        log: {info: vi.fn()},
      } as unknown as FastifyRequest;

      const mockFn = vi.fn().mockResolvedValue({ok: true});
      const customLoader = vi.fn().mockResolvedValue({
        customExport: mockFn,
      });

      const handlerConfig: CustomEndpointFunctionHandler = {
        type: 'function',
        file: 'test.ts',
        exportName: 'customExport',
      };

      await handleFunction(
        mockApp,
        mockRequest,
        mockReply,
        handlerConfig,
        '/virtual/artifact.js',
        customLoader,
      );

      expect(customLoader).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(mockRequest, mockApp);

      // Call second time to verify cache hits without invoking customLoader again
      await handleFunction(
        mockApp,
        mockRequest,
        mockReply,
        handlerConfig,
        '/virtual/artifact.js',
        customLoader,
      );

      expect(customLoader).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
