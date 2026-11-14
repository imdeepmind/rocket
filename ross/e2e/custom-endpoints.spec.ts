/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect, test} from '@playwright/test';

import {resolveConfig} from '@/lib/config/resolve';
import {buildFunctions} from '@/lib/functions/builder';

import {AppConfig, AppConfigInput} from '@/interfaces/config';

import {hash} from '@/utils/hash';

import {createE2EServer, E2EServer} from './helpers/server';

const customEndpointsE2EConfig: AppConfigInput = {
  application: {
    name: 'Rocket E2E - Custom Endpoints',
    logLevel: 'warn',
    dangerouslyOverrideDefaultVariant: 'v1',
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['*'],
      credentials: false,
      routes: ['/**'],
    },
    rateLimit: {
      enabled: true,
      max: 1000,
      timeWindow: '15m',
    },
  },
  docs: {
    openapi: {
      enabled: true,
      path: '/api/docs',
    },
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {
        url: './e2e/.data/test-custom-endpoints.db',
      },
    },
    cache: {
      engine: 'memory',
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
        jwtSecret: 'e2e-custom-endpoints-super-secret-jwt-key-min-32-chars!',
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
      editor: {
        description: 'Editor with read/write access',
        includes: ['viewer'],
      },
      viewer: {
        description: 'Read-only access',
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
          },
          email: {type: 'string', unique: true, nullable: false},
          password: {type: 'string', nullable: false, secret: true},
          role: {type: 'string', nullable: false, default: 'viewer'},
        },
      },
      projects: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
          },
          name: {type: 'string', nullable: false},
          tenant_id: {type: 'integer', nullable: false},
        },
      },
      tasks: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
          },
          project_id: {type: 'integer', nullable: false},
          title: {type: 'string', nullable: false},
          estimate_hours: {type: 'decimal', nullable: false},
          is_completed: {type: 'boolean', nullable: false, default: false},
          version: {type: 'integer', nullable: false, default: 1},
        },
      },
    },
  },
  customEndpoints: {
    getTasksByProject: {
      method: 'GET',
      path: '/projects/:projectId/tasks',
      description: 'Multi-parameter SQL query filtering tasks',
      validation: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: {type: 'integer'},
          minHours: {type: 'number', default: 0},
          isCompleted: {type: 'boolean', default: false},
          limit: {type: 'integer', default: 10},
        },
      },
      handler: {
        type: 'sql',
        sql: 'SELECT * FROM tasks WHERE project_id = [[path.projectId:integer]] AND estimate_hours >= [[query.minHours:decimal]] AND is_completed = [[query.isCompleted:boolean]] LIMIT [[query.limit:integer]];',
      },
    },
    updateTaskDetails: {
      method: 'PUT',
      path: '/projects/:projectId/tasks/:taskId',
      description: 'Multi-parameter SQL mutation updating task details',
      validation: {
        type: 'object',
        required: [
          'projectId',
          'taskId',
          'expectedVersion',
          'title',
          'estimateHours',
          'isCompleted',
        ],
        properties: {
          projectId: {type: 'integer'},
          taskId: {type: 'integer'},
          expectedVersion: {type: 'integer'},
          title: {type: 'string', minLength: 3},
          estimateHours: {type: 'number', minimum: 0.5},
          isCompleted: {type: 'boolean'},
        },
      },
      handler: {
        type: 'sql',
        sql: 'UPDATE tasks SET title = [[body.title:string]], estimate_hours = [[body.estimateHours:decimal]], is_completed = [[body.isCompleted:boolean]], version = version + 1 WHERE id = [[path.taskId:integer]] AND project_id = [[path.projectId:integer]] AND version = [[query.expectedVersion:integer]];',
      },
    },
    searchUsersByEmail: {
      method: 'GET',
      path: '/search-users',
      description: 'Search users with SQL injection prevention check',
      validation: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {type: 'string'},
        },
      },
      handler: {
        type: 'sql',
        sql: 'SELECT id, email, role FROM users WHERE email = [[query.email:string]];',
      },
    },
    protectedSqlAnalytics: {
      method: 'GET',
      path: '/analytics/tasks',
      description: 'Protected SQL aggregation endpoint',
      handler: {
        type: 'sql',
        sql: 'SELECT count(*) as total_tasks, avg(estimate_hours) as avg_hours FROM tasks;',
      },
    },
    complexReportFunction: {
      method: 'POST',
      path: '/projects/:projectId/teams/:teamId/report',
      description: 'Multi-parameter, multi-type custom TypeScript function',
      validation: {
        type: 'object',
        required: [
          'projectId',
          'teamId',
          'format',
          'title',
          'threshold',
          'filterConfig',
          'x-client-id',
        ],
        properties: {
          projectId: {type: 'integer', minimum: 1},
          teamId: {type: 'integer', minimum: 1},
          format: {type: 'string', enum: ['json', 'csv']},
          includeMetrics: {type: 'boolean', default: false},
          title: {type: 'string', minLength: 3},
          threshold: {type: 'number', minimum: 0},
          filterConfig: {
            type: 'object',
            required: ['status'],
            properties: {
              status: {type: 'string'},
              maxItems: {type: 'integer'},
            },
          },
          tags: {type: 'array', items: {type: 'string'}},
          'x-client-id': {type: 'string'},
          'x-correlation-id': {type: 'string'},
        },
      },
      handler: {
        type: 'function',
        file: './e2e/fixtures/functions/report.ts',
        exportName: 'generateReport',
        inputs: {
          path: ['projectId', 'teamId'],
          query: ['format', 'includeMetrics'],
          body: ['title', 'threshold', 'filterConfig', 'tags'],
          headers: ['x-client-id', 'x-correlation-id'],
        },
      },
    },
    syncComputeFunction: {
      method: 'GET',
      path: '/compute/:value',
      description: 'Synchronous custom function handler',
      validation: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {type: 'integer'},
        },
      },
      handler: {
        type: 'function',
        file: './e2e/fixtures/functions/report.ts',
        exportName: 'syncCompute',
        inputs: {
          path: ['value'],
        },
      },
    },
    cacheDbFunction: {
      method: 'GET',
      path: '/task-cache',
      description: 'Cache get/set integration inside function handler',
      handler: {
        type: 'function',
        file: './e2e/fixtures/functions/report.ts',
        exportName: 'cacheDbHandler',
      },
    },
    customErrorFunction: {
      method: 'POST',
      path: '/trigger-error',
      description: 'Function handler triggering explicit status errors',
      validation: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {type: 'integer'},
        },
      },
      handler: {
        type: 'function',
        file: './e2e/fixtures/functions/report.ts',
        exportName: 'errorHandler',
        inputs: {
          body: ['code'],
        },
      },
    },
    protectedAdminFunction: {
      method: 'GET',
      path: '/admin/audit',
      description: 'Protected function endpoint requiring admin role',
      handler: {
        type: 'function',
        file: './e2e/fixtures/functions/report.ts',
        exportName: 'adminAudit',
      },
    },
  },
  apis: {
    'custom.v1.all.unknown.getTasksByProject': {authorization: false},
    'custom.v1.all.unknown.updateTaskDetails': {authorization: false},
    'custom.v1.all.unknown.searchUsersByEmail': {authorization: false},
    'custom.v1.all.unknown.protectedSqlAnalytics': {
      authorization: true,
      roles: ['admin'],
    },
    'custom.v1.all.unknown.complexReportFunction': {authorization: false},
    'custom.v1.all.unknown.syncComputeFunction': {authorization: false},
    'custom.v1.all.unknown.cacheDbFunction': {authorization: false},
    'custom.v1.all.unknown.customErrorFunction': {authorization: false},
    'custom.v1.all.unknown.protectedAdminFunction': {
      authorization: true,
      roles: ['admin'],
    },
  },
};

test.describe('Custom Endpoints E2E Suite (SQL & Functions)', () => {
  let server: E2EServer;
  let adminToken: string;
  let viewerToken: string;

  test.beforeAll(async () => {
    // 1. Compile functions before starting server
    const resolved = resolveConfig(
      customEndpointsE2EConfig as unknown as AppConfig,
      {
        mode: 'dev',
      },
    );
    await buildFunctions({
      config: resolved,
      configDir: process.cwd(),
    });

    // 2. Start E2E Server
    server = await createE2EServer(customEndpointsE2EConfig);

    // 3. Seed users, projects, and tasks
    const passwordHash = await hash('Password123!');
    await server.app.db.query(
      'INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [
        1,
        'admin@example.com',
        passwordHash,
        'admin',
        2,
        'viewer@example.com',
        passwordHash,
        'viewer',
      ],
    );

    await server.app.db.query(
      'INSERT INTO projects (id, name, tenant_id) VALUES (?, ?, ?), (?, ?, ?)',
      [10, 'Alpha Project', 100, 20, 'Beta Project', 200],
    );

    await server.app.db.query(
      'INSERT INTO tasks (id, project_id, title, estimate_hours, is_completed, version) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
      [
        1,
        10,
        'Initial Design',
        4.5,
        1,
        1,
        2,
        10,
        'Backend Implementation',
        8.0,
        0,
        1,
        3,
        10,
        'Database Tuning',
        2.0,
        0,
        1,
      ],
    );

    // 4. Login to obtain tokens
    async function login(email: string): Promise<string> {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {email, password: 'Password123!'},
      });
      expect(res.status()).toBe(200);
      const json = await res.json();
      return json.data.accessToken;
    }

    adminToken = await login('admin@example.com');
    viewerToken = await login('viewer@example.com');
  });

  test.afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: CUSTOM SQL QUERY ENDPOINTS (`type: 'sql'`)
  // --------------------------------------------------------------------------
  test.describe('Custom SQL Queries (`type: "sql"`)', () => {
    test('Positive: Executes multi-parameter SELECT with path, query, float, boolean, and limit', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/projects/10/tasks',
        {
          params: {
            minHours: '3.0',
            isCompleted: 'false',
            limit: '5',
          },
        },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('Success');
      expect(Array.isArray(body.data.data)).toBe(true);
      expect(body.data.data.length).toBe(1);
      expect(body.data.data[0]).toMatchObject({
        id: 2,
        project_id: 10,
        title: 'Backend Implementation',
        estimate_hours: 8.0,
        is_completed: 0,
      });
    });

    test('Positive: Executes multi-parameter UPDATE across path, query, and body and verifies DB mutation', async () => {
      const res = await server.request.put(
        '/api/v1/custom-endpoints/projects/10/tasks/2',
        {
          params: {expectedVersion: '1'},
          data: {
            title: 'Backend Implementation Completed',
            estimateHours: 9.5,
            isCompleted: true,
          },
        },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);

      // Verify that database was directly mutated
      const dbCheck = await server.app.db.query(
        'SELECT * FROM tasks WHERE id = ?',
        [2],
      );
      const updatedTask = dbCheck.rows[0] as any;
      expect(updatedTask.title).toBe('Backend Implementation Completed');
      expect(updatedTask.estimate_hours).toBe(9.5);
      expect(updatedTask.is_completed).toBe(1);
      expect(updatedTask.version).toBe(2);
    });

    test('Positive: SQL search with zero-row result returns empty array in envelope', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/search-users',
        {
          params: {email: 'nobody@example.com'},
        },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toEqual([]);
    });

    test('Positive: SQL parameter binding safely prevents SQL injection attacks', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/search-users',
        {
          params: {email: "' OR '1'='1"},
        },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      // Parameterized query treats entire string as literal email, matching 0 rows
      expect(body.data.data).toEqual([]);
    });

    test('Negative: Validation failure when required body parameters are missing (HTTP 400)', async () => {
      const res = await server.request.put(
        '/api/v1/custom-endpoints/projects/10/tasks/2',
        {
          params: {expectedVersion: '2'},
          data: {
            // title is omitted
            estimateHours: 5.0,
            isCompleted: false,
          },
        },
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('required property');
    });

    test('Negative: Validation failure when type constraint is violated (HTTP 400)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/projects/not-an-int/tasks',
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('params/projectId must be integer');
    });

    test('Negative: Validation failure when numeric minimum constraint is violated (HTTP 400)', async () => {
      const res = await server.request.put(
        '/api/v1/custom-endpoints/projects/10/tasks/2',
        {
          params: {expectedVersion: '2'},
          data: {
            title: 'Task Title',
            estimateHours: 0.1, // Minimum is 0.5
            isCompleted: false,
          },
        },
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('>= 0.5');
    });

    test('Negative: RBAC rejection on protected SQL query when token is missing (HTTP 401)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/analytics/tasks',
      );
      expect(res.status()).toBe(401);
    });

    test('Negative: RBAC rejection on protected SQL query when role is unauthorized (HTTP 403)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/analytics/tasks',
        {
          headers: {Authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });

    test('Positive: RBAC access permitted on protected SQL query with admin role (HTTP 200)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/analytics/tasks',
        {
          headers: {Authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data[0]).toHaveProperty('total_tasks');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: CUSTOM TYPESCRIPT FUNCTION ENDPOINTS (`type: 'function'`)
  // --------------------------------------------------------------------------
  test.describe('Custom TypeScript Functions (`type: "function"`)', () => {
    test('Positive: Exhaustive multi-param execution across path, query, body, and headers with db access', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/projects/10/teams/20/report',
        {
          params: {
            format: 'json',
            includeMetrics: 'true',
          },
          headers: {
            'x-client-id': 'client-alpha',
            'x-correlation-id': 'corr-999',
          },
          data: {
            title: 'Quarterly Executive Review',
            threshold: 12.5,
            filterConfig: {
              status: 'active',
              maxItems: 50,
            },
            tags: ['priority', 'infra', 'q4'],
          },
        },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.message).toBe('Success');
      expect(body.data).toMatchObject({
        projectId: 10,
        teamId: 20,
        format: 'json',
        includeMetrics: true,
        title: 'Quarterly Executive Review',
        threshold: 12.5,
        filterConfig: {
          status: 'active',
          maxItems: 50,
        },
        tags: ['priority', 'infra', 'q4'],
        clientId: 'client-alpha',
        correlationId: 'corr-999',
        dbTaskCount: 3,
        appName: 'Rocket E2E - Custom Endpoints',
      });
    });

    test('Positive: Synchronous function handler returns direct value in envelope', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/compute/8',
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data).toEqual({
        doubled: 16,
        squared: 64,
        isSync: true,
      });
    });

    test('Positive: Cache lifecycle inside function handler (miss -> store -> hit)', async () => {
      // First call: cache miss, stores in cache
      const res1 = await server.request.get(
        '/api/v1/custom-endpoints/task-cache',
      );
      expect(res1.status()).toBe(200);
      const body1 = await res1.json();
      expect(body1.data.fromCache).toBe(false);
      expect(body1.data.value).toBe(3);

      // Second call: cache hit
      const res2 = await server.request.get(
        '/api/v1/custom-endpoints/task-cache',
      );
      expect(res2.status()).toBe(200);
      const body2 = await res2.json();
      expect(body2.data.fromCache).toBe(true);
      expect(body2.data.value).toBe(3);
    });

    test('Negative: Validation failure when required nested body field is missing (HTTP 400)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/projects/10/teams/20/report',
        {
          params: {format: 'json'},
          headers: {'x-client-id': 'client-alpha'},
          data: {
            title: 'Valid Title',
            threshold: 10,
            filterConfig: {
              // status is required inside filterConfig
              maxItems: 10,
            },
          },
        },
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('required property');
    });

    test('Negative: Validation failure when enum constraint is violated (HTTP 400)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/projects/10/teams/20/report',
        {
          params: {format: 'xml'}, // Allowed: ['json', 'csv']
          headers: {'x-client-id': 'client-alpha'},
          data: {
            title: 'Valid Title',
            threshold: 10,
            filterConfig: {status: 'active'},
          },
        },
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('equal to one of the allowed values');
    });

    test('Negative: Validation failure when required header is missing (HTTP 400)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/projects/10/teams/20/report',
        {
          params: {format: 'json'},
          // 'x-client-id' is omitted
          data: {
            title: 'Valid Title',
            threshold: 10,
            filterConfig: {status: 'active'},
          },
        },
      );

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain("required property 'x-client-id'");
    });

    test('Negative: Function throws custom error with statusCode: 404 (HTTP 404)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/trigger-error',
        {
          data: {code: 404},
        },
      );

      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe(404);
      expect(body.message).toBe('Custom entity not found');
      expect(body.data).toBeNull();
    });

    test('Negative: Function throws custom error with statusCode: 409 Conflict (HTTP 409)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/trigger-error',
        {
          data: {code: 409},
        },
      );

      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe(409);
      expect(body.message).toBe('Custom conflict detected');
      expect(body.data).toBeNull();
    });

    test('Negative: Function throws custom error with statusCode: 422 Unprocessable (HTTP 422)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/trigger-error',
        {
          data: {code: 422},
        },
      );

      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe(422);
      expect(body.message).toBe('Semantic validation error');
      expect(body.data).toBeNull();
    });

    test('Negative: Function throws unhandled error without statusCode (HTTP 500)', async () => {
      const res = await server.request.post(
        '/api/v1/custom-endpoints/trigger-error',
        {
          data: {code: 500},
        },
      );

      expect(res.status()).toBe(500);
      const body = await res.json();
      expect(body.code).toBe(500);
      expect(body.message).toBe('Unhandled internal error in function');
      expect(body.data).toBeNull();
    });

    test('Negative: RBAC rejection on protected function when token is missing (HTTP 401)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin/audit',
      );
      expect(res.status()).toBe(401);
    });

    test('Negative: RBAC rejection on protected function when role is unauthorized (HTTP 403)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin/audit',
        {
          headers: {Authorization: `Bearer ${viewerToken}`},
        },
      );
      expect(res.status()).toBe(403);
    });

    test('Positive: RBAC access permitted on protected function with admin role (HTTP 200)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/admin/audit',
        {
          headers: {Authorization: `Bearer ${adminToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.auditPassed).toBe(true);
      expect(body.data.user.role).toBe('admin');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: OPENAPI SPECIFICATION GENERATION (/docs/json)
  // --------------------------------------------------------------------------
  test.describe('OpenAPI / Swagger Documentation', () => {
    test('Generates OpenAPI schema with custom SQL and function endpoints', async () => {
      const res = await server.request.get('/api/docs/json');
      expect(res.status()).toBe(200);
      const spec = await res.json();

      expect(spec).toHaveProperty('paths');
      const paths = spec.paths;

      // Function endpoint path exists
      const functionPath =
        '/api/v1/custom-endpoints/projects/{projectId}/teams/{teamId}/report';
      expect(paths).toHaveProperty(functionPath);
      const postOp = paths[functionPath].post;
      expect(postOp).toBeDefined();

      // Path and query parameters are documented
      const params = postOp.parameters;
      const paramNames = params.map((p: any) => p.name);
      expect(paramNames).toContain('projectId');
      expect(paramNames).toContain('teamId');
      expect(paramNames).toContain('format');
      expect(paramNames).toContain('includeMetrics');
      expect(paramNames).toContain('x-client-id');

      // Request body schema is documented
      expect(postOp.requestBody).toBeDefined();
      const bodyProps =
        postOp.requestBody.content['application/json'].schema.properties;
      expect(bodyProps).toHaveProperty('title');
      expect(bodyProps).toHaveProperty('threshold');
      expect(bodyProps).toHaveProperty('filterConfig');
      expect(bodyProps).toHaveProperty('tags');

      // SQL endpoint path exists
      const sqlPath = '/api/v1/custom-endpoints/projects/{projectId}/tasks';
      expect(paths).toHaveProperty(sqlPath);
      const getOp = paths[sqlPath].get;
      expect(getOp).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: CORS & RATE LIMITING HEADERS
  // --------------------------------------------------------------------------
  test.describe('Framework Plugins Integration (CORS & Rate Limit)', () => {
    test('Applies CORS headers to custom endpoint responses', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/compute/5',
        {
          headers: {Origin: 'https://example.com'},
        },
      );

      expect(res.status()).toBe(200);
      const headers = res.headers();
      expect(headers).toHaveProperty('access-control-allow-origin');
    });

    test('Applies Rate Limit headers to custom endpoint responses', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/compute/5',
      );

      expect(res.status()).toBe(200);
      const headers = res.headers();
      expect(headers).toHaveProperty('x-ratelimit-limit');
      expect(headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
});
