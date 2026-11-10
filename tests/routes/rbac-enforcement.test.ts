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
          apis: ['delete', 'edit', 'index'],
        },
        name: {
          type: 'string',
          nullable: false,
          apis: ['edit', 'search'],
        },
        email: {type: 'string', nullable: false, apis: ['edit']},
        role: {type: 'string', nullable: true, apis: ['edit']},
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
      auditor: {
        includes: ['viewer'],
      },
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
    'model.v1.users.id.edit': {
      enabled: true,
      authorization: true,
      roles: ['editor:senior', 'admin'],
    },
    'model.v1.users.name.search': {
      enabled: true,
      authorization: true,
      roles: ['auditor', 'admin'],
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
    'custom.v1.all.unknown.wildcard': {
      enabled: true,
      authorization: true,
      roles: ['*'],
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
    wildcard: {
      description: 'Wildcard endpoint accessible by any authenticated role',
      method: 'GET',
      path: '/wildcard',
      handler: {
        type: 'sql',
        sql: 'SELECT 1 as value;',
      },
    },
  };

  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    pgClientQueryMock.mockReset();
    pgQueryMock.mockReset();
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

    test('returns 403 Forbidden when user has unauthorized role for PUT edit', async () => {
      const token = app.jwt.sign({
        id: 20,
        email: 'junior@example.com',
        role: 'editor:junior',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Name',
          email: 'updated@example.com',
          role: 'editor:junior',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe(
        'Forbidden: Insufficient permissions',
      );
    });

    test('returns 200 when user has editor:senior role for PUT edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 21,
        email: 'senior@example.com',
        role: 'editor:senior',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Senior Update',
          email: 'senior@example.com',
          role: 'editor:senior',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        name: 'Senior Update',
        email: 'senior@example.com',
        role: 'editor:senior',
      });
    });

    test('returns 200 when user has array roles and at least one is authorized for PUT edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 22,
        email: 'multi@example.com',
        roles: ['guest', 'editor:senior'],
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Multi Role Update',
          email: 'multi@example.com',
          role: 'editor:senior',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test('returns 403 when user has array roles and none are authorized for PUT edit', async () => {
      const token = app.jwt.sign({
        id: 23,
        email: 'multi-fail@example.com',
        roles: ['guest', 'viewer'],
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Multi Role Fail',
          email: 'fail@example.com',
          role: 'viewer',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('returns 403 Forbidden when user has viewer role for PATCH edit', async () => {
      const token = app.jwt.sign({
        id: 24,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Patch Attempt',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('returns 200 when user has admin role for PATCH edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 25,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Admin Patch',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({name: 'Admin Patch'});
    });

    test('returns 403 Forbidden when user has unauthorized role for PUT edit', async () => {
      const token = app.jwt.sign({
        id: 20,
        email: 'junior@example.com',
        role: 'editor:junior',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Name',
          email: 'updated@example.com',
          role: 'editor:junior',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe(
        'Forbidden: Insufficient permissions',
      );
    });

    test('returns 200 when user has editor:senior role for PUT edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 21,
        email: 'senior@example.com',
        role: 'editor:senior',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Senior Update',
          email: 'senior@example.com',
          role: 'editor:senior',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        name: 'Senior Update',
        email: 'senior@example.com',
        role: 'editor:senior',
      });
    });

    test('returns 200 when user has array roles and at least one is authorized for PUT edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 22,
        email: 'multi@example.com',
        roles: ['guest', 'editor:senior'],
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Multi Role Update',
          email: 'multi@example.com',
          role: 'editor:senior',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test('returns 403 when user has array roles and none are authorized for PUT edit', async () => {
      const token = app.jwt.sign({
        id: 23,
        email: 'multi-fail@example.com',
        roles: ['guest', 'viewer'],
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Multi Role Fail',
          email: 'fail@example.com',
          role: 'viewer',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('returns 403 Forbidden when user has viewer role for PATCH edit', async () => {
      const token = app.jwt.sign({
        id: 24,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Patch Attempt',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('returns 200 when user has admin role for PATCH edit', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 1}) // UPDATE
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 25,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/id/1',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Admin Patch',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({name: 'Admin Patch'});
    });
  });

  describe('Model Search route authorization', () => {
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

    test('returns 401 Unauthorized when unauthenticated request calls search route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
    });

    test('returns 403 Forbidden when user lacks auditor or admin role on search route', async () => {
      const token = app.jwt.sign({
        id: 30,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe(
        'Forbidden: Insufficient permissions',
      );
    });

    test('returns 200 when user has auditor role on search route', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 31,
        email: 'auditor@example.com',
        role: 'auditor',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([
        {id: 1, name: 'Alice', email: 'alice@example.com'},
      ]);
    });

    test('returns 200 when user has inherited admin role on search route', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 32,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Model Search route authorization', () => {
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

    test('returns 401 Unauthorized when unauthenticated request calls search route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe(
        'Invalid or expired authentication token',
      );
    });

    test('returns 403 Forbidden when user lacks auditor or admin role on search route', async () => {
      const token = app.jwt.sign({
        id: 30,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe(
        'Forbidden: Insufficient permissions',
      );
    });

    test('returns 200 when user has auditor role on search route', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 31,
        email: 'auditor@example.com',
        role: 'auditor',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([
        {id: 1, name: 'Alice', email: 'alice@example.com'},
      ]);
    });

    test('returns 200 when user has inherited admin role on search route', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{total: 1}]}) // COUNT
        .mockResolvedValueOnce({
          rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
          rowCount: 1,
        })
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = app.jwt.sign({
        id: 32,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/search/name?name_search=Alice',
        headers: {
          authorization: `Bearer ${token}`,
        },
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

    test('returns 401 Unauthorized on wildcard custom endpoint when unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/wildcard',
      });

      expect(response.statusCode).toBe(401);
    });

    test('returns 200 on wildcard custom endpoint for any authenticated user role', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{value: 1}],
        rowCount: 1,
      });

      const token = app.jwt.sign({
        id: 33,
        email: 'viewer@example.com',
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/custom-endpoints/wildcard',
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
