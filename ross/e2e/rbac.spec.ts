import {expect, test} from '@playwright/test';

import {AppConfigInput} from '@/interfaces/config';

import {hash} from '@/utils/hash';

import {createE2EServer, E2EServer} from './helpers/server';

const rbacE2EConfig: AppConfigInput = {
  application: {
    name: 'Rocket E2E - RBAC',
    logLevel: 'warn',
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {
        url: './e2e/.data/test-rbac.db',
      },
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
        jwtSecret:
          'e2e-rbac-super-secret-jwt-key-for-testing-at-least-32-chars!',
      },
    },
  },
  rbac: {
    enabled: true,
    modelName: 'users',
    roleField: 'role',
    defaultRole: 'viewer',
    roles: {
      admin: {
        description: 'Administrator with full system access',
        includes: ['*'],
      },
      'editor:senior': {
        description: 'Senior editor with publishing and edit rights',
        includes: ['editor:junior'],
      },
      'editor:junior': {
        description: 'Junior editor with drafting and reading rights',
        includes: ['viewer'],
      },
      viewer: {
        description: 'Read-only access to published content',
      },
    },
  },
  data: {
    models: {
      users: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
            apis: ['delete', 'edit', 'index'],
          },
          email: {
            type: 'string',
            nullable: false,
            apis: ['edit'],
          },
          password: {
            type: 'string',
            nullable: false,
            secret: true,
            apis: ['edit'],
          },
          role: {
            type: 'string',
            nullable: false,
            apis: ['edit'],
          },
        },
      },
      articles: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
            apis: ['delete', 'edit', 'index'],
            aggregations: ['count'],
          },
          title: {
            type: 'string',
            nullable: false,
            apis: ['edit', 'search'],
          },
          content: {
            type: 'string',
            nullable: false,
            apis: ['edit'],
          },
          author_id: {
            type: 'integer',
            nullable: false,
            apis: ['edit'],
          },
        },
      },
    },
  },
  customEndpoints: {
    adminAnalytics: {
      description: 'Admin-only analytics metric',
      method: 'GET',
      path: '/admin-analytics',
      handler: {
        type: 'sql',
        sql: 'SELECT 42 as metric;',
      },
    },
    editorDashboard: {
      description: 'Dashboard for all editors',
      method: 'GET',
      path: '/editor-dashboard',
      handler: {
        type: 'sql',
        sql: 'SELECT 100 as queue_count;',
      },
    },
    publicInfo: {
      description: 'Public system statistics',
      method: 'GET',
      path: '/public-info',
      handler: {
        type: 'sql',
        sql: 'SELECT 1 as is_online;',
      },
    },
    wildcardEndpoint: {
      description: 'Endpoint open to all authenticated roles via *',
      method: 'GET',
      path: '/wildcard-endpoint',
      handler: {
        type: 'sql',
        sql: 'SELECT 123 as wildcard_val;',
      },
    },
    openAuthEndpoint: {
      description: 'Endpoint with authorization true but no roles configured',
      method: 'GET',
      path: '/open-auth-endpoint',
      handler: {
        type: 'sql',
        sql: 'SELECT 999 as open_val;',
      },
    },
  },
  apis: {
    'model.v1.articles.unknown.getAll': {
      authorization: true,
      roles: ['viewer'],
    },
    'model.v1.articles.id.index': {
      authorization: true,
      roles: ['viewer'],
    },
    'model.v1.articles.title.search': {
      authorization: true,
      roles: ['viewer'],
    },
    'aggregate.v1.articles.id.getAggregation': {
      authorization: true,
      roles: ['admin'],
    },
    'model.v1.articles.unknown.insert': {
      authorization: true,
      roles: ['editor:junior'],
    },
    'model.v1.articles.id.edit': {
      authorization: true,
      roles: ['editor:senior'],
    },
    'model.v1.articles.id.delete': {
      authorization: true,
      roles: ['admin'],
    },
    'custom.v1.all.unknown.adminAnalytics': {
      authorization: true,
      roles: ['admin'],
    },
    'custom.v1.all.unknown.editorDashboard': {
      authorization: true,
      roles: ['editor:*'],
    },
    'custom.v1.all.unknown.publicInfo': {
      authorization: false,
    },
    'custom.v1.all.unknown.wildcardEndpoint': {
      authorization: true,
      roles: ['*'],
    },
    'custom.v1.all.unknown.openAuthEndpoint': {
      authorization: true,
    },
  },
};

test.describe.serial('Playwright E2E: RBAC Role Enforcement', () => {
  let server: E2EServer;
  let adminToken: string;
  let seniorToken: string;
  let juniorToken: string;
  let viewerToken: string;

  test.beforeAll(async () => {
    server = await createE2EServer(rbacE2EConfig);

    // Seed test users with bcrypt-hashed passwords
    const passwordHash = await hash('Password123!');
    await server.app.db.query(
      'INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      [
        1,
        'admin@example.com',
        passwordHash,
        'admin',
        2,
        'senior@example.com',
        passwordHash,
        'editor:senior',
        3,
        'junior@example.com',
        passwordHash,
        'editor:junior',
        4,
        'viewer@example.com',
        passwordHash,
        'viewer',
      ],
    );

    // Seed initial articles
    await server.app.db.query(
      'INSERT INTO articles (id, title, content, author_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [
        1,
        'Published Article 1',
        'Content of article 1',
        1,
        2,
        'Article for Deletion',
        'Content to be deleted',
        1,
      ],
    );

    // Helper to log in a user and verify issued JWT payload contains the role claim
    async function login(email: string, expectedRole: string): Promise<string> {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email,
          password: 'Password123!',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data).toHaveProperty('accessToken');

      const token = body.data.accessToken;
      const decoded = server.app.jwt.decode(token) as Record<string, unknown>;
      expect(decoded.role).toBe(expectedRole);
      return token;
    }

    adminToken = await login('admin@example.com', 'admin');
    seniorToken = await login('senior@example.com', 'editor:senior');
    juniorToken = await login('junior@example.com', 'editor:junior');
    viewerToken = await login('viewer@example.com', 'viewer');
  });

  test.afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  test.describe('Unauthenticated Workflows (Negative & Public)', () => {
    test('GET /api/v1/articles/ returns 401 Unauthorized without token', async () => {
      const res = await server.request.get('/api/v1/articles/');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe(401);
      expect(body.message).toBe('Invalid or expired authentication token');
    });

    test('POST /api/v1/articles/ returns 401 Unauthorized without token', async () => {
      const res = await server.request.post('/api/v1/articles/', {
        data: {
          title: 'Unauth Post',
          content: 'Should fail',
          author_id: 1,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/custom-endpoints/admin-analytics returns 401 Unauthorized without token', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin-analytics',
      );
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/custom-endpoints/public-info succeeds without token', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/public-info',
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
    });
  });

  test.describe('Invalid / Tampered / Malformed Token Workflows (Negative)', () => {
    test('request with malformed token returns 401 Unauthorized', async () => {
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: 'Bearer this-is-not-a-valid-jwt-token'},
      });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe(401);
      expect(body.message).toBe('Invalid or expired authentication token');
    });

    test('request with invalid signature (tampered token) returns 401 Unauthorized', async () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiJ9.invalidSignatureWrongSecret1234567890';
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${invalidToken}`},
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Undeclared or Missing Role Payload Workflows (Negative)', () => {
    test('authenticated user with undeclared role is forbidden (403 Forbidden)', async () => {
      const unknownRoleToken = server.app.jwt.sign({
        id: 99,
        email: 'intruder@example.com',
        role: 'intruder',
      });
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${unknownRoleToken}`},
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe(403);
      expect(body.message).toBe('Forbidden: Insufficient permissions');
    });

    test('authenticated user without any role claim is forbidden (403 Forbidden)', async () => {
      const noRoleToken = server.app.jwt.sign({
        id: 100,
        email: 'norole@example.com',
      });
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${noRoleToken}`},
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe(403);
      expect(body.message).toBe('Forbidden: Insufficient permissions');
    });
  });

  test.describe('Viewer Role Workflows', () => {
    test('viewer can GET all articles (200 OK)', async () => {
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${viewerToken}`},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data.length).toBeGreaterThan(0);
    });

    test('viewer can GET a single article by ID (200 OK)', async () => {
      const res = await server.request.get('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${viewerToken}`},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data.id).toBe(1);
    });

    test('viewer cannot POST a new article (403 Forbidden)', async () => {
      const res = await server.request.post('/api/v1/articles/', {
        headers: {authorization: `Bearer ${viewerToken}`},
        data: {
          title: 'Viewer Attempt',
          content: 'Viewer content',
          author_id: 4,
        },
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe(403);
      expect(body.message).toBe('Forbidden: Insufficient permissions');
    });

    test('viewer cannot PUT an article (403 Forbidden)', async () => {
      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${viewerToken}`},
        data: {
          title: 'Updated by Viewer',
          content: 'Updated content',
          author_id: 4,
        },
      });
      expect(res.status()).toBe(403);
    });

    test('viewer cannot DELETE an article (403 Forbidden)', async () => {
      const res = await server.request.delete('/api/v1/articles/id/1', {
        headers: {
          authorization: `Bearer ${viewerToken}`,
          'content-type': 'text/plain',
        },
      });
      expect(res.status()).toBe(403);
    });

    test('viewer cannot access custom admin-analytics (403 Forbidden)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin-analytics',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });

    test('viewer cannot access custom editor-dashboard (403 Forbidden)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/editor-dashboard',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Junior Editor Role Workflows', () => {
    test('editor:junior can GET articles via transitive role inclusion (200 OK)', async () => {
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${juniorToken}`},
      });
      expect(res.status()).toBe(200);
    });

    test('editor:junior can POST a new article (201 Created)', async () => {
      const res = await server.request.post('/api/v1/articles/', {
        headers: {authorization: `Bearer ${juniorToken}`},
        data: {
          title: 'Junior Draft',
          content: 'Draft content created by junior editor',
          author_id: 3,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.code).toBe(201);
      expect(body.data.title).toBe('Junior Draft');
    });

    test('editor:junior cannot PUT an article (403 Forbidden)', async () => {
      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${juniorToken}`},
        data: {
          title: 'Junior Edit Attempt',
          content: 'Content',
          author_id: 3,
        },
      });
      expect(res.status()).toBe(403);
    });

    test('editor:junior cannot DELETE an article (403 Forbidden)', async () => {
      const res = await server.request.delete('/api/v1/articles/id/1', {
        headers: {
          authorization: `Bearer ${juniorToken}`,
          'content-type': 'text/plain',
        },
      });
      expect(res.status()).toBe(403);
    });

    test('editor:junior can access editor-dashboard via editor:* wildcard (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/editor-dashboard',
        {
          headers: {authorization: `Bearer ${juniorToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data[0].queue_count).toBe(100);
    });

    test('editor:junior cannot access admin-analytics (403 Forbidden)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin-analytics',
        {
          headers: {authorization: `Bearer ${juniorToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Senior Editor Role Workflows', () => {
    test('editor:senior can GET articles via inherited viewer role (200 OK)', async () => {
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${seniorToken}`},
      });
      expect(res.status()).toBe(200);
    });

    test('editor:senior can POST articles via inherited editor:junior role (201 Created)', async () => {
      const res = await server.request.post('/api/v1/articles/', {
        headers: {authorization: `Bearer ${seniorToken}`},
        data: {
          title: 'Senior Article',
          content: 'Senior author content',
          author_id: 2,
        },
      });
      expect(res.status()).toBe(201);
    });

    test('editor:senior can PUT an article (200 OK)', async () => {
      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${seniorToken}`},
        data: {
          title: 'Updated by Senior Editor',
          content: 'Polished senior content',
          author_id: 2,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.title).toBe('Updated by Senior Editor');
    });

    test('editor:senior can PATCH an article (200 OK)', async () => {
      const res = await server.request.patch('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${seniorToken}`},
        data: {
          title: 'Partially Patched Title',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.title).toBe('Partially Patched Title');
    });

    test('editor:senior cannot DELETE an article (403 Forbidden)', async () => {
      const res = await server.request.delete('/api/v1/articles/id/1', {
        headers: {
          authorization: `Bearer ${seniorToken}`,
          'content-type': 'text/plain',
        },
      });
      expect(res.status()).toBe(403);
    });

    test('editor:senior can access editor-dashboard via editor:* wildcard (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/editor-dashboard',
        {
          headers: {authorization: `Bearer ${seniorToken}`},
        },
      );
      expect(res.status()).toBe(200);
    });

    test('editor:senior cannot access admin-analytics (403 Forbidden)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin-analytics',
        {
          headers: {authorization: `Bearer ${seniorToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Admin Role Workflows (Full System Access via includes: ["*"])', () => {
    test('admin can GET articles (200 OK)', async () => {
      const res = await server.request.get('/api/v1/articles/', {
        headers: {authorization: `Bearer ${adminToken}`},
      });
      expect(res.status()).toBe(200);
    });

    test('admin can POST a new article (201 Created)', async () => {
      const res = await server.request.post('/api/v1/articles/', {
        headers: {authorization: `Bearer ${adminToken}`},
        data: {
          title: 'Admin Article',
          content: 'Admin content',
          author_id: 1,
        },
      });
      expect(res.status()).toBe(201);
    });

    test('admin can PUT an article (200 OK)', async () => {
      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${adminToken}`},
        data: {
          title: 'Admin Updated Title',
          content: 'Admin content overwrite',
          author_id: 1,
        },
      });
      expect(res.status()).toBe(200);
    });

    test('admin can PATCH an article (200 OK)', async () => {
      const res = await server.request.patch('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${adminToken}`},
        data: {
          content: 'Admin patched content',
        },
      });
      expect(res.status()).toBe(200);
    });

    test('admin can DELETE an article (204 No Content)', async () => {
      const res = await server.request.delete('/api/v1/articles/id/2', {
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'text/plain',
        },
      });
      expect(res.status()).toBe(204);
    });

    test('admin can access custom admin-analytics (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin-analytics',
        {
          headers: {authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data[0].metric).toBe(42);
    });

    test('admin can access custom editor-dashboard via wildcard (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/editor-dashboard',
        {
          headers: {authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Universal Wildcard Route (roles: ["*"]) Workflows', () => {
    test('viewer can access endpoint configured with roles: ["*"] (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/wildcard-endpoint',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data[0].wildcard_val).toBe(123);
    });

    test('editor:junior can access endpoint configured with roles: ["*"] (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/wildcard-endpoint',
        {
          headers: {authorization: `Bearer ${juniorToken}`},
        },
      );
      expect(res.status()).toBe(200);
    });

    test('admin can access endpoint configured with roles: ["*"] (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/wildcard-endpoint',
        {
          headers: {authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
    });

    test('unauthenticated request to roles: ["*"] endpoint returns 401 Unauthorized', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/wildcard-endpoint',
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Route with authorization: true and No Roles Configured', () => {
    test('viewer can access route with authorization: true and no roles (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/open-auth-endpoint',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data[0].open_val).toBe(999);
    });

    test('unauthenticated request to open auth endpoint returns 401 Unauthorized', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/open-auth-endpoint',
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Search Route Role Enforcement', () => {
    test('viewer can search articles by title (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/articles/search/title?title_search=Title',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data.length).toBeGreaterThan(0);
      expect(body.data.data[0].title).toContain('Title');
    });

    test('unauthenticated search request returns 401 Unauthorized', async () => {
      const res = await server.request.get(
        '/api/v1/articles/search/title?title_search=Title',
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Aggregation Route Role Enforcement', () => {
    test('admin can access count aggregation on articles (200 OK)', async () => {
      const res = await server.request.get(
        '/api/v1/articles/aggregation/id?operations=count',
        {
          headers: {authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data).toHaveProperty('count');
    });

    test('viewer cannot access admin-only aggregation (403 Forbidden)', async () => {
      const res = await server.request.get(
        '/api/v1/articles/aggregation/id?operations=count',
        {
          headers: {authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe(403);
      expect(body.message).toBe('Forbidden: Insufficient permissions');
    });

    test('unauthenticated aggregation request returns 401 Unauthorized', async () => {
      const res = await server.request.get(
        '/api/v1/articles/aggregation/id?operations=count',
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Multi-Role JWT Token Claims', () => {
    test('user with multiple roles is authorized if at least one role matches', async () => {
      const multiToken = server.app.jwt.sign({
        id: 10,
        email: 'multirole@example.com',
        roles: ['guest', 'editor:senior'],
      });

      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${multiToken}`},
        data: {
          title: 'Multi-Role Updated Title',
          content: 'Multi-role content',
          author_id: 10,
        },
      });
      expect(res.status()).toBe(200);
    });

    test('user with multiple roles is forbidden if none match', async () => {
      const multiFailToken = server.app.jwt.sign({
        id: 11,
        email: 'multifail@example.com',
        roles: ['guest', 'viewer'],
      });

      const res = await server.request.put('/api/v1/articles/id/1', {
        headers: {authorization: `Bearer ${multiFailToken}`},
        data: {
          title: 'Multi-Role Fail Title',
          content: 'Multi-role fail content',
          author_id: 11,
        },
      });
      expect(res.status()).toBe(403);
    });
  });
});

test.describe
  .serial('Playwright E2E: Disabled RBAC Mode (rbac.enabled: false)', () => {
  let disabledServer: E2EServer;
  let testUserToken: string;

  const disabledRbacConfig: AppConfigInput = {
    application: {
      name: 'Rocket E2E - Disabled RBAC',
      logLevel: 'warn',
    },
    infrastructure: {
      database: {
        engine: 'sqlite',
        connection: {
          url: './e2e/.data/test-rbac-disabled.db',
        },
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
          jwtSecret:
            'disabled-rbac-super-secret-jwt-key-for-testing-at-least-32-chars!',
        },
      },
    },
    rbac: {
      enabled: false,
    },
    data: {
      models: {
        users: {
          fields: {
            id: {
              type: 'integer',
              primaryKey: true,
              autoIncrement: true,
              nullable: false,
            },
            email: {
              type: 'string',
              nullable: false,
            },
            password: {
              type: 'string',
              nullable: false,
              secret: true,
            },
          },
        },
      },
    },
    customEndpoints: {
      authEndpoint: {
        description: 'Endpoint with authorization required',
        method: 'GET',
        path: '/auth-endpoint',
        handler: {
          type: 'sql',
          sql: 'SELECT 777 as value;',
        },
      },
    },
    apis: {
      'custom.v1.all.unknown.authEndpoint': {
        authorization: true,
      },
    },
  };

  test('server startup rejects roles in apis when rbac is disabled', async () => {
    const invalidConfig: AppConfigInput = {
      ...disabledRbacConfig,
      apis: {
        'custom.v1.all.unknown.authEndpoint': {
          authorization: true,
          roles: ['admin'],
        },
      },
    };

    await expect(createE2EServer(invalidConfig)).rejects.toThrow(
      'roles cannot be configured when rbac is not enabled',
    );
  });

  test.beforeAll(async () => {
    disabledServer = await createE2EServer(disabledRbacConfig);

    const passwordHash = await hash('Password123!');
    await disabledServer.app.db.query(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      [1, 'plainuser@example.com', passwordHash],
    );

    const res = await disabledServer.request.post('/api/v1/auth/login', {
      data: {
        email: 'plainuser@example.com',
        password: 'Password123!',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    testUserToken = body.data.accessToken;
  });

  test.afterAll(async () => {
    if (disabledServer) {
      await disabledServer.cleanup();
    }
  });

  test('any authenticated user can access route when RBAC is disabled', async () => {
    const res = await disabledServer.request.get(
      '/api/v1/custom-endpoints/auth-endpoint',
      {
        headers: {authorization: `Bearer ${testUserToken}`},
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(200);
    expect(body.data.data[0].value).toBe(777);
  });

  test('unauthenticated request is still rejected (401 Unauthorized) when RBAC is disabled', async () => {
    const res = await disabledServer.request.get(
      '/api/v1/custom-endpoints/auth-endpoint',
    );
    expect(res.status()).toBe(401);
  });
});
