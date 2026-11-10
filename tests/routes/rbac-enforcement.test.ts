import {FastifyInstance} from 'fastify';
import {beforeEach, describe, expect, test, vi} from 'vitest';

import {
  ApisConfig,
  AuthenticationConfig,
  CustomEndpointConfig,
  ModelConfig,
  RbacConfig,
} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

describe('RBAC Route-Level PreValidation Enforcement', () => {
  const usersModel: Record<string, ModelConfig> = {
    users: {
      fields: {
        id: {
          type: 'integer',
          primaryKey: true,
          autoIncrement: true,
          apis: ['delete'],
        },
        name: {type: 'string', nullable: false},
        email: {type: 'string', nullable: false},
        role: {type: 'string', nullable: true},
      },
    },
  };

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
        jwtSecret: 'test-secret-key-that-is-long-enough-for-jwt',
      },
    },
  };

  const rbacConfig: RbacConfig = {
    enabled: true,
    modelName: 'users',
    roleField: 'role',
    defaultRole: 'viewer',
    roles: {
      admin: {
        includes: ['*'],
      },
      manager: {
        includes: ['editor:*'],
      },
      'editor:senior': {
        includes: ['editor:junior'],
      },
      'editor:junior': {},
      viewer: {},
    },
  };

  const apisConfig: ApisConfig = {
    'model.v1.users.unknown.getAll': {
      enabled: true,
      authorization: true,
      roles: ['admin', 'manager'],
    },
    'model.v1.users.unknown.insert': {
      enabled: true,
      authorization: true,
      roles: ['editor:*'],
    },
    'model.v1.users.id.delete': {
      enabled: true,
      authorization: true,
      // No roles specified -> warning logged, access permitted
    },
    'model.v1.users.id.index': {
      enabled: true,
      authorization: false, // Public route
    },
    'custom.v1.all.unknown.secureSummary': {
      enabled: true,
      authorization: true,
      roles: ['admin'],
    },
  };

  const customEndpoints: Record<string, CustomEndpointConfig> = {
    secureSummary: {
      description: 'Secure summary endpoint',
      method: 'GET',
      path: '/summary',
      handler: {
        type: 'sql',
        sql: 'SELECT 1 as value;',
      },
    },
  };

  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('Model CRUD route authorization', () => {
    beforeEach(async () => {
      app = await createTestApp(
        pgConfig,
        usersModel,
        apisConfig,
        customEndpoints,
        upAuthConfig,
        undefined,
        rbacConfig,
      );
    });

    test('returns 401 Unauthorized when no token is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.code).toBe(401);
      expect(body.message).toBe('Invalid or expired authentication token');
    });

    test('returns 401 Unauthorized when an invalid token is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: 'Bearer invalid.jwt.token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    test('returns 403 Forbidden when user has role that does not match', async () => {
      const token = app.jwt.sign({
        id: 1,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body).toEqual({
        code: 403,
        message: 'Forbidden: Insufficient permissions',
        data: null,
      });
    });

    test('returns 403 Forbidden when user roles array does not match', async () => {
      const token = app.jwt.sign({
        id: 2,
        email: 'user@example.com',
        roles: ['viewer', 'editor:junior'],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe(403);
    });

    test('returns 200 OK when user has exact matching role', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [
            {id: 1, name: 'Manager', email: 'mgr@example.com', role: 'manager'},
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 3,
        email: 'manager@example.com',
        role: 'manager',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);
    });

    test('returns 200 OK when user matches via transitive inclusion (admin includes *)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [
            {id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin'},
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 4,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test('allows POST when user role matches wildcard endpoint roles (editor:junior matches editor:*)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              name: 'New User',
              email: 'new@example.com',
              role: 'viewer',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 5,
        email: 'editor@example.com',
        role: 'editor:junior',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'New User',
          email: 'new@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    test('allows POST when user has manager role (includes editor:*)', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 11,
              name: 'New User 2',
              email: 'new2@example.com',
              role: 'viewer',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 6,
        email: 'mgr@example.com',
        role: 'manager',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'New User 2',
          email: 'new2@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    test('logs warning and permits access when endpoint has authorization: true without roles', async () => {
      const warnSpy = vi.spyOn(app.log, 'warn');

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: 'Deleted User',
              email: 'del@example.com',
              role: 'viewer',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // DELETE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 7,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(204);
      expect(warnSpy).toHaveBeenCalledWith(
        'Route has authorization enabled but no roles configured',
      );
    });

    test('permits access to public endpoint without authentication', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: 'Public User',
              email: 'pub@example.com',
              role: 'viewer',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/id/1',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Custom endpoints authorization', () => {
    beforeEach(async () => {
      app = await createTestApp(
        pgConfig,
        usersModel,
        apisConfig,
        customEndpoints,
        upAuthConfig,
        undefined,
        rbacConfig,
      );
    });

    test('returns 403 on custom endpoint when user lacks role', async () => {
      const token = app.jwt.sign({
        id: 8,
        email: 'editor@example.com',
        role: 'editor:senior',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/summary',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('returns 200 on custom endpoint when user has admin role', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{value: 1}],
        rowCount: 1,
      });

      const token = app.jwt.sign({
        id: 9,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/summary',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('When RBAC is disabled', () => {
    test('permits any authenticated user even if roles are configured in apis', async () => {
      pgClientQueryMock.mockReset();
      pgClientQueryMock.mockResolvedValue({rows: [], rowCount: 0});

      const disabledRbacConfig: RbacConfig = {
        enabled: false,
      };

      const disabledApp = await createTestApp(
        pgConfig,
        usersModel,
        apisConfig,
        customEndpoints,
        upAuthConfig,
        undefined,
        disabledRbacConfig,
      );

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [
            {id: 1, name: 'Alice', email: 'alice@example.com', role: 'viewer'},
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      // User has viewer role which would normally be forbidden for GET /v1/users/
      const token = disabledApp.jwt.sign({
        id: 10,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await disabledApp.inject({
        method: 'GET',
        url: '/v1/users/',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);
      await disabledApp.close();
    });
  });
});
