import {describe, expect, test, vi} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';
import {buildPreValidation} from '@/lib/server/prevalidation';

import {ResolvedAppConfig} from '@/interfaces/config';

describe('buildPreValidation', () => {
  const buildMockApp = (overrides: Record<string, unknown> = {}) => ({
    buildResponse: vi.fn((code: number, message: string, data: unknown) => ({
      code,
      message,
      data,
    })),
    ...overrides,
  });

  const buildMockRequest = (overrides: Record<string, unknown> = {}) => {
    const authenticate = vi.fn().mockResolvedValue(undefined);
    return {authenticate, ...overrides};
  };

  const buildMockReply = (overrides: Record<string, unknown> = {}) => {
    const status = vi.fn().mockReturnThis();
    const send = vi.fn().mockReturnThis();
    return {status, send, ...overrides};
  };

  const baseAppConfig = resolveConfig(
    {
      application: {name: 'test', logLevel: 'info'},
      docs: {
        openapi: {
          enabled: false,
          path: '/docs',
          info: {title: 'Test', version: '1.0.0'},
        },
      },
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost:5432/test'},
        },
      },
      data: {models: {}},
    },
    {mode: 'dev'},
  );

  const authEnabledConfig: ResolvedAppConfig = resolveConfig(
    {
      application: {name: 'test', logLevel: 'info'},
      data: {models: {}},
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            userModel: {
              model: 'user',
              idField: 'id',
              usernameField: 'email',
              passwordField: 'password',
            },
          },
        },
      },
    },
    {mode: 'dev'},
  );

  const authDisabledConfig: ResolvedAppConfig = {
    ...baseAppConfig,
    authentication: {enabled: false},
  };

  // --- default checks: ['auth'] ---

  test('default checks: calls authenticate when auth succeeds', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('default checks: returns 401 when auth fails', async () => {
    const app = buildMockApp();
    const request = buildMockRequest({
      authenticate: vi.fn().mockRejectedValue(new Error('bad token')),
    });
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      app.buildResponse(401, 'Invalid or expired authentication token', null),
    );
  });

  test('default checks: skips auth when auth is disabled', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authDisabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
  });

  test('default checks: skips auth when authorization is false', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, false);
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
  });

  // --- single checks ---

  test('auth only: calls authenticate', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true, [
      'auth',
    ]);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
  });

  test('default checks should be auth only', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, authEnabledConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
  });

  test('auth fails with 401 when api-key provider is used', async () => {
    const apiKeyConfig: ResolvedAppConfig = {
      ...baseAppConfig,
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'test-key'}},
      },
    };
    const app = buildMockApp();
    const request = buildMockRequest({
      authenticate: vi.fn().mockRejectedValue(new Error('bad key')),
    });
    const reply = buildMockReply();

    const handler = buildPreValidation(app as never, apiKeyConfig, true);
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(401);
  });
});
