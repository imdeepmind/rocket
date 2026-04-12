import {expect, test, describe, beforeEach} from 'vitest';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';
import {ModelConfig} from '@/schema/config';
import {pgQueryMock} from '@tests/helpers/db-mocks';

const defaultEditModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: ['editable'],
      },
      {name: 'name', type: 'string'},
      {name: 'email', type: 'string'},
    ],
  },
];

const nonUniqueEditModel: ModelConfig[] = [
  {
    name: 'tasks',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {
        name: 'status',
        type: 'string',
        supportedOperations: ['editable', 'equal', 'lessThan'], // Non-unique identifier
      },
      {name: 'title', type: 'string'},
    ],
  },
];

const validatedEditModel: ModelConfig[] = [
  {
    name: 'posts',
    validation: {
      type: 'object',
      properties: {
        title: {type: 'string'},
        content: {type: 'string'},
      },
      required: ['title', 'content'],
    },
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: ['editable'],
      },
      {name: 'title', type: 'string'},
      {name: 'content', type: 'string'},
    ],
  },
];

describe('test edit api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
  });

  describe('PATCH partial updates', () => {
    test('should return 200 on successful PATCH update', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          name: 'Bob',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({name: 'Bob'});
      expect(response.json().message).toBe(
        'Successfully updated records in the users table',
      );

      await fastify.close();
    });

    test('should build the correct UPDATE SQL for PATCH', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/users/id/5',
        payload: {
          email: 'bob@example.com',
          name: 'Bob',
        },
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      const callArgs = pgQueryMock.mock.calls[0];
      // Note: order of keys is not guaranteed by Object.keys, but usually preserved
      expect(callArgs[0]).toMatch(
        /UPDATE "users" SET ".*" = \$1, ".*" = \$2 WHERE "id" = \$3/,
      );
      expect(callArgs[1].length).toBe(3);
      expect(callArgs[1]).toContain(5); // The id path param should be the last param

      await fastify.close();
    });

    test('should return 400 when body is empty', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should remove the identifying field from the body if mistakenly provided', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          id: 999, // User trying to edit the ID
          name: 'Alice',
        },
      });

      // The update query should only set "name"
      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "users" SET "name" = $1 WHERE "id" = $2',
        ['Alice', 1],
      );

      await fastify.close();
    });
  });

  describe('PUT complete updates', () => {
    test('should return 200 on successful PUT update with all required fields', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {
          name: 'Charlie',
          email: 'charlie@example.com',
        },
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });

    test('should return 400 if a required field is missing in PUT request', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/users/id/1',
        payload: {
          name: 'Charlie',
          // email is missing, but required for PUT
        },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe('custom validation logic', () => {
    test('should respect custom model validation for PUT', async () => {
      const fastify = await createTestApp(pgConfig, validatedEditModel);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/posts/id/1',
        payload: {
          title: 'Title',
          // content is missing, validation requires both
        },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should allow partial custom validation for PATCH (required removed)', async () => {
      const fastify = await createTestApp(pgConfig, validatedEditModel);

      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 1});

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/posts/id/1',
        payload: {
          title: 'Only Title', // content is missing, but PATCH removes required array
        },
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });
  });

  describe('filtering on non-unique edit routes', () => {
    test('should apply query filters to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_lt=10', // editing tasks with status pending AND id < 10
        payload: {
          title: 'Urgent Pending Task',
        },
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" < $3',
        ['Urgent Pending Task', 'pending', '10'],
      );

      await fastify.close();
    });

    test('should apply _lte filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_lte=5',
        payload: {title: 'Update'},
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" <= $3',
        ['Update', 'pending', '5'],
      );

      await fastify.close();
    });

    test('should apply _gt filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_gt=1',
        payload: {title: 'Update'},
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" > $3',
        ['Update', 'pending', '1'],
      );

      await fastify.close();
    });

    test('should apply _gte filter to WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?id_gte=2',
        payload: {title: 'Update'},
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2 AND "id" >= $3',
        ['Update', 'pending', '2'],
      );

      await fastify.close();
    });

    test('should ignore pagination and sorting params in the query string', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?page=1&limit=10&orderBy=id&orderDir=asc',
        payload: {
          title: 'Ignored Params Task',
        },
      });

      // Query should not include page, limit, or order stuff in WHERE
      expect(pgQueryMock).toHaveBeenCalledWith(
        'UPDATE "tasks" SET "title" = $1 WHERE "status" = $2',
        ['Ignored Params Task', 'pending'],
      );

      await fastify.close();
    });

    test('should apply multiple filter params (_eq, _in)', async () => {
      const fastify = await createTestApp(pgConfig, nonUniqueEditModel);

      await fastify.inject({
        method: 'PATCH',
        url: '/tasks/status/pending?title_eq=foo&id_in=1,2,3',
        payload: {
          title: 'Bulk updated foo',
        },
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain(
        'WHERE "status" = $2 AND "title" = $3 AND "id" IN ($4, $5, $6)',
      );

      await fastify.close();
    });
  });

  describe('error handling / edge cases', () => {
    test('should return 400 for unknown keys in body (they get stripped)', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/id/1',
        payload: {
          unknownField: 'value', // This is stripped
        },
      });

      // Because unknownField is stripped and the resulting body is empty, it fails length == 0
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('No fields provided for update');

      await fastify.close();
    });

    test('should return 404 for fields without editable operation', async () => {
      const fastify = await createTestApp(pgConfig, defaultEditModel);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/users/name/Alice', // name is not editable identifying field
        payload: {
          email: 'alice@example.com',
        },
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});
