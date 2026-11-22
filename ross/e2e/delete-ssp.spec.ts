import {expect, test} from '@playwright/test';

import {AppConfigInput} from '@/interfaces/config';

import {createE2EServer, E2EServer} from './helpers/server';

const deleteSspE2EConfig: AppConfigInput = {
  application: {
    name: 'Rocket E2E - Delete SSP',
    logLevel: 'warn',
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {
        url: './e2e/.data/test-delete-ssp.db',
      },
    },
  },
  authentication: {
    enabled: true,
    jwtSecret: 'super-secret-jwt-key-for-delete-ssp-testing-32chars',
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
          },
          email: {
            type: 'string',
            unique: true,
            nullable: false,
          },
          password: {
            type: 'string',
            nullable: false,
            secret: true,
          },
          provider: {
            type: 'string',
            nullable: true,
          },
        },
      },
      todos: {
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            autoIncrement: true,
            nullable: false,
            apis: ['index'],
          },
          title: {
            type: 'string',
            nullable: false,
          },
          status: {
            type: 'string',
            nullable: false,
            apis: ['delete'],
            query: ['eq'],
          },
          owner_id: {
            type: 'integer',
            nullable: false,
            query: ['eq'],
          },
        },
      },
    },
  },
  apis: {
    'model.v1.todos.status.delete': {
      enabled: true,
      authorization: true,
      serverSideParams: [
        {
          name: 'owner_id_eq',
          type: 'query',
          value: '[[userId]]',
        },
      ],
    },
    'model.v1.todos.unknown.getAll': {
      enabled: true,
      authorization: true,
    },
  },
};

test.describe
  .serial('E2E: DELETE API with SSP ownership scoping on non-unique field', () => {
  let server: E2EServer;
  let user1Token: string;
  let user2Token: string;

  test.beforeAll(async () => {
    server = await createE2EServer(deleteSspE2EConfig);

    user1Token = server.app.jwt.sign({id: 1, email: 'user1@example.com'});
    user2Token = server.app.jwt.sign({id: 2, email: 'user2@example.com'});
  });

  test.afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  test.beforeEach(async () => {
    await server.app.db.query('DELETE FROM todos;');
    await server.app.db.query(
      'INSERT INTO todos (id, title, status, owner_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [1, 'User 1 Todo', 'active', 1, 2, 'User 2 Todo', 'active', 2],
    );
  });

  test('User 1 cannot delete User 2 todo (scoped by [[userId]])', async () => {
    const res = await server.request.delete('/api/v1/todos/status/active', {
      headers: {
        authorization: `Bearer ${user1Token}`,
        'content-type': 'text/plain',
      },
    });

    expect(res.status()).toBe(204);

    // Todo 2 must still exist in the database because owner_id was scoped to 1
    const checkRes = await server.app.db.query<{id: number}>(
      'SELECT id FROM todos WHERE id = ?',
      [2],
    );
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].id).toBe(2);

    // Todo 1 must have been deleted
    const checkTodo1 = await server.app.db.query<{id: number}>(
      'SELECT id FROM todos WHERE id = ?',
      [1],
    );
    expect(checkTodo1.rows.length).toBe(0);
  });

  test('User 2 can delete their own todo', async () => {
    const res = await server.request.delete('/api/v1/todos/status/active', {
      headers: {
        authorization: `Bearer ${user2Token}`,
        'content-type': 'text/plain',
      },
    });

    expect(res.status()).toBe(204);

    // Todo 2 must be deleted from the database
    const checkRes = await server.app.db.query<{id: number}>(
      'SELECT id FROM todos WHERE id = ?',
      [2],
    );
    expect(checkRes.rows.length).toBe(0);
  });
});
