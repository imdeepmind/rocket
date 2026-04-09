import { expect, test, describe } from 'vitest';
import { createTestApp, pgConfig } from '../helpers/test-app';
import { ModelConfig } from '../../src/schema/config';
import { pgQueryMock } from '../helpers/db-mocks';

const deleteMockModels: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: ['deletable'],
      },
      { name: 'name', type: 'string' },
    ],
  },
];

describe('test delete api', () => {
  test('should delete a record from users table', async () => {
    const fastify = await createTestApp(pgConfig, deleteMockModels);

    const response = await fastify.inject({
      method: 'DELETE',
      url: '/users/id/1',
    });

    expect(response.statusCode).toBe(204);

    // Verify the query was called correctly
    expect(pgQueryMock).toHaveBeenCalledWith('DELETE FROM "users" WHERE "id" = $1;', [1]);

    await fastify.close();
  });

  test('should handle delete for different field', async () => {
    const customModels: ModelConfig[] = [
      {
        name: 'posts',
        fields: [
          { name: 'slug', type: 'string', supportedOperations: ['deletable'] },
          { name: 'title', type: 'string' },
        ],
      },
    ];
    const fastify = await createTestApp(pgConfig, customModels);

    const response = await fastify.inject({
      method: 'DELETE',
      url: '/posts/slug/hello-world',
    });

    expect(response.statusCode).toBe(204);

    // Verify the query was called correctly
    expect(pgQueryMock).toHaveBeenCalledWith('DELETE FROM "posts" WHERE "slug" = $1;', [
      'hello-world',
    ]);

    await fastify.close();
  });
});
