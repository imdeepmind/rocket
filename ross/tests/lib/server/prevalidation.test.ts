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

    const handler = buildPreValidation(
      app as never,
      authEnabledConfig,
      true,
      undefined,
      ['auth'],
    );
    await handler(request as never, reply as never);

    expect(request.authenticate).toHaveBeenCalledTimes(1);
  });

  test('skips auth when checks does not include auth', async () => {
    const app = buildMockApp();
    const request = buildMockRequest();
    const reply = buildMockReply();

    const handler = buildPreValidation(
      app as never,
      authEnabledConfig,
      true,
      undefined,
      [],
    );
    await handler(request as never, reply as never);

    expect(request.authenticate).not.toHaveBeenCalled();
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

  // --- RBAC authorization enforcement ---

  describe('RBAC authorization enforcement', () => {
    const rbacEnabledConfig: ResolvedAppConfig = resolveConfig(
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
        rbac: {
          enabled: true,
          modelName: 'user',
          roleField: 'role',
          defaultRole: 'viewer',
          roles: {
            admin: {
              includes: ['*'],
            },
            lead_editor: {
              includes: ['editor:*'],
            },
            'editor:senior': {
              includes: ['editor:junior', 'viewer'],
            },
            'editor:junior': {
              includes: ['viewer'],
            },
            viewer: {},
          },
        },
      },
      {mode: 'dev'},
    );

    test('permits access when user role directly matches route allowed roles', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 1, email: 'admin@example.com', role: 'admin'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['admin']),
      );
      await handler(request as never, reply as never);

      expect(request.authenticate).toHaveBeenCalledTimes(1);
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    test('permits access via transitive wildcard inclusion (admin includes *)', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 1, email: 'admin@example.com', role: 'admin'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['editor:junior']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).not.toHaveBeenCalled();
    });

    test('permits access via namespace wildcard inclusion (lead_editor includes editor:*)', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 2, email: 'editor@example.com', role: 'lead_editor'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['editor:senior']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).not.toHaveBeenCalled();
    });

    test('permits access when user has multiple roles and one matches', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {
          id: 3,
          email: 'multi@example.com',
          roles: ['viewer', 'editor:senior'],
        },
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['editor:junior']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).not.toHaveBeenCalled();
    });

    test('returns 403 Forbidden when user role is not authorized', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 4, email: 'viewer@example.com', role: 'viewer'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['admin']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        app.buildResponse(403, 'Forbidden: Insufficient permissions', null),
      );
    });

    test('returns 403 Forbidden when none of the user roles match', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {
          id: 5,
          email: 'viewer@example.com',
          roles: ['viewer'],
        },
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['editor:junior']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        app.buildResponse(403, 'Forbidden: Insufficient permissions', null),
      );
    });

    test('returns 403 Forbidden when user has no role or roles in payload', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 6, email: 'norole@example.com'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        new Set(['admin']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).toHaveBeenCalledWith(403);
    });

    test('logs warning and permits access when authorization is true but no roles configured', async () => {
      const warnSpy = vi.fn();
      const app = buildMockApp({log: {warn: warnSpy}});
      const request = buildMockRequest({
        user: {id: 7, email: 'user@example.com', role: 'viewer'},
        log: {warn: warnSpy},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        undefined,
      );
      await handler(request as never, reply as never);

      expect(warnSpy).toHaveBeenCalledWith(
        'Route has authorization enabled but no roles configured',
      );
      expect(reply.status).not.toHaveBeenCalled();
    });

    test('logs warning and permits access when roles is an empty array', async () => {
      const warnSpy = vi.fn();
      const app = buildMockApp({log: {warn: warnSpy}});
      const request = buildMockRequest({
        user: {id: 8, email: 'user@example.com', role: 'viewer'},
        log: {warn: warnSpy},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        [],
      );
      await handler(request as never, reply as never);

      expect(warnSpy).toHaveBeenCalledWith(
        'Route has authorization enabled but no roles configured',
      );
      expect(reply.status).not.toHaveBeenCalled();
    });

    test('normalizes string array of roles with wildcards', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 9, email: 'editor@example.com', role: 'editor:junior'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacEnabledConfig,
        true,
        ['editor:*'],
      );
      await handler(request as never, reply as never);

      expect(reply.status).not.toHaveBeenCalled();
    });

    test('normalizes string array of roles when RBAC is disabled or roles is absent', async () => {
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 11, email: 'admin@example.com', role: 'admin'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        authEnabledConfig,
        true,
        ['admin'],
      );
      await handler(request as never, reply as never);

      expect(request.authenticate).toHaveBeenCalledTimes(1);
      expect(reply.status).not.toHaveBeenCalled();
    });

    test('handles rbac.enabled true with undefined rbac.roles', async () => {
      const rbacNoRolesConfig: ResolvedAppConfig = {
        ...rbacEnabledConfig,
        rbac: {
          enabled: true,
          modelName: 'user',
          roleField: 'role',
          defaultRole: 'viewer',
        },
      };
      const app = buildMockApp();
      const request = buildMockRequest({
        user: {id: 12, email: 'admin@example.com', role: 'admin'},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacNoRolesConfig,
        true,
        new Set(['admin']),
      );
      await handler(request as never, reply as never);

      expect(reply.status).not.toHaveBeenCalled();
    });

    test('permits access without 403 or warning when RBAC is disabled', async () => {
      const warnSpy = vi.fn();
      const rbacDisabledConfig: ResolvedAppConfig = {
        ...rbacEnabledConfig,
        rbac: {enabled: false},
      };
      const app = buildMockApp({log: {warn: warnSpy}});
      const request = buildMockRequest({
        user: {id: 10, email: 'user@example.com', role: 'viewer'},
        log: {warn: warnSpy},
      });
      const reply = buildMockReply();

      const handler = buildPreValidation(
        app as never,
        rbacDisabledConfig,
        true,
        new Set(['admin']),
      );
      await handler(request as never, reply as never);

      expect(request.authenticate).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(reply.status).not.toHaveBeenCalled();
    });
  });
});
