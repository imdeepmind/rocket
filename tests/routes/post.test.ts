import { expect, test, describe } from 'vitest';
import { createTestApp, pgConfig, mockModels } from '../helpers/test-app';

describe('test post api', () => {
  test('should create a new post', async () => {
    const fastify = await createTestApp(pgConfig, mockModels);

    const response = await fastify.inject({
      method: 'POST',
      url: '/users/',
      payload: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      code: 201,
      message: 'Successfully added the new entry to the users table',
      data: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      },
      raw_data: {
        rows: [],
        changes: 0,
      },
    });

    await fastify.close();
  });
});
