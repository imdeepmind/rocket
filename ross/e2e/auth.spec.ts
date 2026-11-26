import {expect, test} from '@playwright/test';

import {AppConfigInput} from '@/interfaces/config';

import {createE2EServer, E2EServer} from './helpers/server';

// ---------------------------------------------------------------------------
// 1. API Key Authentication Config & E2E Tests
// ---------------------------------------------------------------------------

const apiKeyE2EConfig: AppConfigInput = {
  application: {
    name: 'Rocket E2E - API Key Auth',
    logLevel: 'warn',
    healthCheck: {
      enabled: true,
      path: '/health',
    },
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {
        url: './e2e/.data/test-apikey.db',
      },
    },
  },
  authentication: {
    enabled: true,
    providers: [
      {
        type: 'api-key',
        config: {
          key: 'valid-secret-api-key-12345',
        },
      },
    ],
  },
  data: {
    models: {
      items: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
            apis: ['index', 'edit', 'delete'],
          },
          name: {
            type: 'string',
            nullable: false,
            apis: ['search', 'edit'],
          },
          price: {
            type: 'decimal',
            nullable: false,
            apis: ['edit'],
          },
        },
      },
    },
  },
  customEndpoints: {
    statusCheck: {
      description: 'Protected status endpoint requiring API key',
      method: 'GET',
      path: '/status-check',
      handler: {
        type: 'sql',
        sql: 'SELECT 1 as is_active;',
      },
    },
    publicInfo: {
      description: 'Public status endpoint not requiring API key',
      method: 'GET',
      path: '/public-info',
      handler: {
        type: 'sql',
        sql: 'SELECT 100 as public_val;',
      },
    },
  },
  apis: {
    'model.v1.items.unknown.getAll': {
      authorization: true,
    },
    'model.v1.items.unknown.insert': {
      authorization: true,
    },
    'model.v1.items.id.index': {
      authorization: true,
    },
    'model.v1.items.id.edit': {
      authorization: true,
    },
    'model.v1.items.id.delete': {
      authorization: true,
    },
    'custom.v1.all.unknown.statusCheck': {
      authorization: true,
    },
    'custom.v1.all.unknown.publicInfo': {
      authorization: false,
    },
  },
};

test.describe.serial('Playwright E2E: API Key Authentication (api-key)', () => {
  let server: E2EServer;
  const validKey = 'valid-secret-api-key-12345';
  const invalidKey = 'invalid-wrong-api-key';

  test.beforeAll(async () => {
    server = await createE2EServer(apiKeyE2EConfig);
  });

  test.afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  test.describe('Unauthenticated and Invalid API Key Requests (Negative)', () => {
    test('GET /api/v1/items/ returns 401 Unauthorized when x-api-key is missing', async () => {
      const res = await server.request.get('/api/v1/items/');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe(401);
      expect(body.message).toContain('Invalid or expired authentication token');
    });

    test('POST /api/v1/items/ returns 401 Unauthorized when x-api-key is missing', async () => {
      const res = await server.request.post('/api/v1/items/', {
        data: {name: 'Unauthorized Item', price: 9.99},
      });
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/custom-endpoints/status-check returns 401 Unauthorized when x-api-key is missing', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/status-check',
      );
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/items/ returns 401 Unauthorized with invalid x-api-key', async () => {
      const res = await server.request.get('/api/v1/items/', {
        headers: {'x-api-key': invalidKey},
      });
      expect(res.status()).toBe(401);
    });

    test('POST /api/v1/items/ returns 401 Unauthorized with invalid x-api-key', async () => {
      const res = await server.request.post('/api/v1/items/', {
        headers: {'x-api-key': invalidKey},
        data: {name: 'Invalid Key Item', price: 19.99},
      });
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/custom-endpoints/status-check returns 401 Unauthorized with invalid x-api-key', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/status-check',
        {
          headers: {'x-api-key': invalidKey},
        },
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Valid API Key Requests (Positive)', () => {
    let createdItemId: number;

    test('POST /api/v1/items/ creates a new item with valid x-api-key (HTTP 201)', async () => {
      const res = await server.request.post('/api/v1/items/', {
        headers: {'x-api-key': validKey},
        data: {name: 'Keyboard', price: 49.99},
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.code).toBe(201);
      expect(body.data).toBeDefined();
      expect(body.data.name).toBe('Keyboard');
      expect(body.data.price).toBe(49.99);
    });

    test('GET /api/v1/items/ retrieves all items with valid x-api-key (HTTP 200)', async () => {
      const res = await server.request.get('/api/v1/items/', {
        headers: {'x-api-key': validKey},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.data)).toBe(true);
      expect(body.data.data.length).toBeGreaterThanOrEqual(1);

      const item = body.data.data.find(
        (i: {name: string}) => i.name === 'Keyboard',
      );
      expect(item).toBeDefined();
      createdItemId = item.id;
      expect(createdItemId).toBeGreaterThan(0);
    });

    test('GET /api/v1/items/id/:id retrieves single item with valid x-api-key (HTTP 200)', async () => {
      const res = await server.request.get(
        `/api/v1/items/id/${createdItemId}`,
        {
          headers: {'x-api-key': validKey},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data.id).toBe(createdItemId);
      expect(body.data.data.name).toBe('Keyboard');
    });

    test('PUT /api/v1/items/id/:id updates item with valid x-api-key (HTTP 200)', async () => {
      const res = await server.request.put(
        `/api/v1/items/id/${createdItemId}`,
        {
          headers: {'x-api-key': validKey},
          data: {name: 'Mechanical Keyboard', price: 89.99},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.name).toBe('Mechanical Keyboard');
      expect(body.data.price).toBe(89.99);
    });

    test('GET /api/v1/custom-endpoints/status-check succeeds with valid x-api-key (HTTP 200)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/status-check',
        {
          headers: {'x-api-key': validKey},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toEqual([{is_active: 1}]);
    });

    test('DELETE /api/v1/items/id/:id deletes item with valid x-api-key', async () => {
      const res = await server.request.delete(
        `/api/v1/items/id/${createdItemId}`,
        {
          headers: {'x-api-key': validKey, 'content-type': 'text/plain'},
        },
      );
      expect([200, 204]).toContain(res.status());

      const verifyRes = await server.request.get(
        `/api/v1/items/id/${createdItemId}`,
        {
          headers: {'x-api-key': validKey},
        },
      );
      expect(verifyRes.status()).toBe(200);
      const verifyBody = await verifyRes.json();
      expect(verifyBody.data.data).toBeNull();
    });
  });

  test.describe('Public Endpoints and Absence of Identity Routes', () => {
    test('Public custom endpoint does not require x-api-key (HTTP 200)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/public-info',
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toEqual([{public_val: 100}]);
    });

    test('Health check route does not require x-api-key (HTTP 200)', async () => {
      const res = await server.request.get('/health');
      expect(res.status()).toBe(200);
    });

    test('Identity and user routes are not registered in API key deployments (HTTP 404)', async () => {
      const loginRes = await server.request.post('/api/v1/auth/login', {
        data: {email: 'user@example.com', password: 'Password123!'},
      });
      expect(loginRes.status()).toBe(404);

      const regRes = await server.request.post('/api/v1/auth/register', {
        data: {email: 'user@example.com', password: 'Password123!'},
      });
      expect(regRes.status()).toBe(404);

      const meRes = await server.request.get('/api/v1/auth/user/me');
      expect(meRes.status()).toBe(404);

      const providersRes = await server.request.get('/api/v1/auth/providers');
      expect(providersRes.status()).toBe(404);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Username & Password Authentication (up-auth) Config & E2E Tests
// ---------------------------------------------------------------------------

const upAuthE2EConfig: AppConfigInput = {
  application: {
    name: 'Rocket E2E - UP Auth',
    logLevel: 'warn',
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {
        url: './e2e/.data/test-upauth.db',
      },
    },
  },
  authentication: {
    enabled: true,
    jwtSecret: 'e2e-up-auth-jwt-secret-at-least-32-chars-long!',
    accessTokenExpiration: '1h',
    userModel: {
      modelName: 'users',
      idField: 'id',
      providerField: 'provider',
    },
    providers: [
      {
        type: 'up-auth',
        config: {
          fields: {
            usernameField: 'email',
            passwordField: 'password',
          },
        },
      },
    ],
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
            apis: ['index', 'edit', 'delete'],
          },
          email: {
            type: 'string',
            unique: true,
            nullable: false,
            apis: ['search', 'edit'],
          },
          password: {
            type: 'string',
            nullable: false,
            secret: true,
            apis: ['edit'],
          },
          provider: {
            type: 'string',
            nullable: true,
          },
          full_name: {
            type: 'string',
            nullable: true,
            apis: ['edit'],
          },
        },
      },
      notes: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
            apis: ['index', 'delete'],
          },
          title: {
            type: 'string',
            nullable: false,
            apis: ['search', 'edit'],
          },
        },
      },
    },
  },
  customEndpoints: {
    noteCount: {
      description: 'Protected note count endpoint',
      method: 'GET',
      path: '/notes-count',
      handler: {
        type: 'sql',
        sql: 'SELECT COUNT(*) as count FROM notes;',
      },
    },
  },
  apis: {
    'model.v1.notes.unknown.getAll': {
      authorization: true,
    },
    'model.v1.notes.unknown.insert': {
      authorization: true,
    },
    'custom.v1.all.unknown.noteCount': {
      authorization: true,
    },
  },
};

test.describe
  .serial('Playwright E2E: Username & Password Authentication (up-auth)', () => {
  let server: E2EServer;
  let authToken: string;
  let refreshToken: string;

  const testUser = {
    email: 'alice@example.com',
    password: 'Password123!',
    full_name: 'Alice Cooper',
  };

  test.beforeAll(async () => {
    server = await createE2EServer(upAuthE2EConfig);
  });

  test.afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  test.describe('Providers Discovery Endpoint', () => {
    test('GET /api/v1/auth/providers returns configured up-auth provider (HTTP 200)', async () => {
      const res = await server.request.get('/api/v1/auth/providers');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(
        body.data.some(
          (provider: {type: string}) => provider.type === 'up-auth',
        ),
      ).toBe(true);
    });
  });

  test.describe('User Registration (POST /api/v1/auth/register)', () => {
    test('Rejects registration with missing password (HTTP 400)', async () => {
      const res = await server.request.post('/api/v1/auth/register', {
        data: {email: 'missing-pass@example.com'},
      });
      expect(res.status()).toBe(400);
    });

    test('Rejects registration with missing email (HTTP 400)', async () => {
      const res = await server.request.post('/api/v1/auth/register', {
        data: {password: 'Password123!'},
      });
      expect(res.status()).toBe(400);
    });

    test('Successfully registers a new user without exposing secret password (HTTP 201)', async () => {
      const res = await server.request.post('/api/v1/auth/register', {
        data: testUser,
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.code).toBe(201);
      expect(body.data).toBeDefined();
      expect(body.data.email).toBe(testUser.email);
      expect(body.data.full_name).toBe(testUser.full_name);
      expect(body.data.provider).toBe('up-auth');
      expect(body.data.password).toBeUndefined();
    });

    test('Rejects registration with duplicate email address (conflict)', async () => {
      const res = await server.request.post('/api/v1/auth/register', {
        data: testUser,
      });
      expect([400, 409, 500]).toContain(res.status());
    });
  });

  test.describe('User Login (POST /api/v1/auth/login)', () => {
    test('Rejects login with non-existent email (HTTP 401)', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'Password123!',
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Rejects login with invalid password (HTTP 401)', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: 'WrongPassword!',
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Authenticates successfully with valid credentials and issues accessToken & refreshToken (HTTP 200)', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: testUser.password,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data).toBeDefined();
      expect(typeof body.data.accessToken).toBe('string');
      expect(typeof body.data.refreshToken).toBe('string');
      authToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
      expect(authToken.length).toBeGreaterThan(20);
      expect(refreshToken.length).toBeGreaterThan(20);
    });

    test('Refreshes tokens via POST /api/v1/auth/refresh and rotates refreshToken (HTTP 200)', async () => {
      const res = await server.request.post('/api/v1/auth/refresh', {
        data: {refreshToken},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.data.accessToken).toBe('string');
      expect(typeof body.data.refreshToken).toBe('string');
      expect(body.data.refreshToken).not.toBe(refreshToken);

      // Reusing old refresh token must fail with 401
      const replayRes = await server.request.post('/api/v1/auth/refresh', {
        data: {refreshToken},
      });
      expect(replayRes.status()).toBe(401);

      authToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    });

    test('Revokes refresh token on POST /api/v1/auth/logout (HTTP 200)', async () => {
      const logoutRes = await server.request.post('/api/v1/auth/logout', {
        headers: {Authorization: `Bearer ${authToken}`},
        data: {refreshToken},
      });
      expect(logoutRes.status()).toBe(200);

      const refreshAfterLogout = await server.request.post(
        '/api/v1/auth/refresh',
        {
          data: {refreshToken},
        },
      );
      expect(refreshAfterLogout.status()).toBe(401);

      // Re-login to leave authToken & refreshToken valid for subsequent tests
      const loginRes = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: testUser.password,
        },
      });
      expect(loginRes.status()).toBe(200);
      const loginBody = await loginRes.json();
      authToken = loginBody.data.accessToken;
      refreshToken = loginBody.data.refreshToken;
    });
  });

  test.describe('Protected Resource Authorization via JWT', () => {
    test('GET /api/v1/notes/ returns 401 Unauthorized without Authorization header', async () => {
      const res = await server.request.get('/api/v1/notes/');
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/notes/ returns 401 Unauthorized with malformed Bearer token', async () => {
      const res = await server.request.get('/api/v1/notes/', {
        headers: {Authorization: 'Bearer invalid.token.signature'},
      });
      expect(res.status()).toBe(401);
    });

    test('POST /api/v1/notes/ creates resource with valid Bearer token (HTTP 201)', async () => {
      const res = await server.request.post('/api/v1/notes/', {
        headers: {Authorization: `Bearer ${authToken}`},
        data: {title: 'First Protected Note'},
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.code).toBe(201);
      expect(body.data.title).toBe('First Protected Note');
    });

    test('GET /api/v1/notes/ lists resources with valid Bearer token (HTTP 200)', async () => {
      const res = await server.request.get('/api/v1/notes/', {
        headers: {Authorization: `Bearer ${authToken}`},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(Array.isArray(body.data.data)).toBe(true);
      expect(body.data.data.length).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/v1/custom-endpoints/notes-count succeeds with valid Bearer token (HTTP 200)', async () => {
      const res = await server.request.get(
        '/api/v1/custom-endpoints/notes-count',
        {
          headers: {Authorization: `Bearer ${authToken}`},
        },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.data).toEqual([{count: 1}]);
    });
  });

  test.describe('User Self-Profile Management (/api/v1/auth/user/me)', () => {
    test('GET /api/v1/auth/user/me returns 401 Unauthorized without token', async () => {
      const res = await server.request.get('/api/v1/auth/user/me');
      expect(res.status()).toBe(401);
    });

    test('GET /api/v1/auth/user/me returns user profile with valid token (HTTP 200)', async () => {
      const res = await server.request.get('/api/v1/auth/user/me', {
        headers: {Authorization: `Bearer ${authToken}`},
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.email).toBe(testUser.email);
      expect(body.data.full_name).toBe(testUser.full_name);
      expect(body.data.password).toBeUndefined();
    });

    test('PATCH /api/v1/auth/user/me updates profile fields (HTTP 200)', async () => {
      const res = await server.request.patch('/api/v1/auth/user/me', {
        headers: {Authorization: `Bearer ${authToken}`},
        data: {full_name: 'Alice Alison'},
      });
      expect(res.status()).toBe(200);

      const profileRes = await server.request.get('/api/v1/auth/user/me', {
        headers: {Authorization: `Bearer ${authToken}`},
      });
      expect(profileRes.status()).toBe(200);
      const body = await profileRes.json();
      expect(body.data.full_name).toBe('Alice Alison');
    });
  });

  test.describe('Password Change Flow (POST /api/v1/auth/change-password)', () => {
    const newPassword = 'NewSecretPassword456!';

    test('Rejects password change without Authorization header (HTTP 401)', async () => {
      const res = await server.request.post('/api/v1/auth/change-password', {
        data: {
          existingPassword: testUser.password,
          newPassword,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Rejects password change with wrong existing password (HTTP 401)', async () => {
      const res = await server.request.post('/api/v1/auth/change-password', {
        headers: {Authorization: `Bearer ${authToken}`},
        data: {
          existingPassword: 'IncorrectOldPassword!',
          newPassword,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Changes password successfully with valid current password (HTTP 200)', async () => {
      const res = await server.request.post('/api/v1/auth/change-password', {
        headers: {Authorization: `Bearer ${authToken}`},
        data: {
          existingPassword: testUser.password,
          newPassword,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
    });

    test('Login with old password now fails (HTTP 401)', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: testUser.password,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Login with new password succeeds and issues updated token (HTTP 200)', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: newPassword,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.code).toBe(200);
      expect(body.data.accessToken).toBeDefined();
      authToken = body.data.accessToken;
    });
  });

  test.describe('Account Deletion (DELETE /api/v1/auth/user/me)', () => {
    test('Rejects delete account without token (HTTP 401)', async () => {
      const res = await server.request.delete('/api/v1/auth/user/me', {
        headers: {'content-type': 'text/plain'},
      });
      expect(res.status()).toBe(401);
    });

    test('Deletes user account with valid token (HTTP 200)', async () => {
      const res = await server.request.delete('/api/v1/auth/user/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'content-type': 'text/plain',
        },
      });
      expect([200, 204]).toContain(res.status());
    });

    test('Accessing profile with deleted user token returns 404', async () => {
      const res = await server.request.get('/api/v1/auth/user/me', {
        headers: {Authorization: `Bearer ${authToken}`},
      });
      expect(res.status()).toBe(404);
    });

    test('Login with deleted user credentials returns 401 Unauthorized', async () => {
      const res = await server.request.post('/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: 'NewSecretPassword456!',
        },
      });
      expect(res.status()).toBe(401);
    });
  });
});
