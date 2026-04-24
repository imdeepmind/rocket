import {beforeEach, describe, expect, test} from 'vitest';

import {ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const getAllModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: [
          'sortable',
          'equal',
          'lessThan',
          'lessThanEqual',
          'greaterThan',
          'greaterThanEqual',
          'oneOf',
        ],
      },
      {
        name: 'name',
        type: 'string',
        supportedOperations: ['sortable', 'searchable', 'equal'],
      },
      {
        name: 'email',
        type: 'string',
        supportedOperations: ['equal'],
      },
    ],
  },
];

describe('test get-all api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should return 200 with data and pagination', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {id: 1, name: 'Alice', email: 'alice@example.com'},
          {id: 2, name: 'Bob', email: 'bob@example.com'},
        ],
        rowCount: 2,
      });

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data[0].name).toBe('Alice');
      expect(body.data.pagination).toBeDefined();

      await fastify.close();
    });

    test('should build the correct SELECT SQL with default pagination', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/'});

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should return empty data array when no rows are found', async () => {
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/',
      });

      expect(response.json().data.data).toEqual([]);

      await fastify.close();
    });

    test('should include correct message in the response', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/',
      });

      expect(response.json().message).toBe(
        'Successfully retrieved records from the users table',
      );

      await fastify.close();
    });
  });

  describe('pagination', () => {
    test('should use custom page and limit values', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/?page=2&limit=10',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT $1 OFFSET $2;',
        [10, 10], // page 2, limit 10 = offset 10
      );

      await fastify.close();
    });

    test('should default to page=1 when page param is 0 or missing', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?page=0'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should return pagination in the response body', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/?page=3&limit=15',
      });

      expect(response.json().data.pagination).toEqual({
        page: 3,
        limit: 15,
      });

      await fastify.close();
    });
  });

  describe('filtering', () => {
    test('should apply _eq filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?name_eq=Alice'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "name" = $1 LIMIT $2 OFFSET $3;',
        ['Alice', 20, 0],
      );

      await fastify.close();
    });

    test('should apply _lt filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?id_lt=10'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" < $1 LIMIT $2 OFFSET $3;',
        [10, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _lte filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?id_lte=100'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" <= $1 LIMIT $2 OFFSET $3;',
        [100, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gt filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?id_gt=5'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" > $1 LIMIT $2 OFFSET $3;',
        [5, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gte filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?id_gte=1'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" >= $1 LIMIT $2 OFFSET $3;',
        [1, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _in filter in WHERE clause', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?id_in=1,2,3'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" IN ($1, $2, $3) LIMIT $4 OFFSET $5;',
        ['1', '2', '3', 20, 0],
      );

      await fastify.close();
    });

    test('should combine multiple filters with AND', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/?name_eq=Bob&id_gt=10',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"name" = $1');
      expect(callArgs[0]).toContain('"id" > $2');
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1][0]).toBe('Bob');
      expect(callArgs[1][1]).toBe(10);

      await fastify.close();
    });
  });

  describe('sorting', () => {
    test('should apply ORDER BY ASC when orderBy is set', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?orderBy=name'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" ORDER BY "name" ASC LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should apply ORDER BY DESC when orderDir=desc', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/?orderBy=id&orderDir=desc',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" ORDER BY "id" DESC LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });

    test('should not add ORDER BY clause when orderBy is absent', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?orderDir=desc'});

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);
      pgQueryMock.mockRejectedValueOnce(new Error('Database error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 for a route that does not match any model', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/unknown-table/',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should return rows in data even when model has no filterable fields', async () => {
      const emptyModel: ModelConfig[] = [
        {name: 'tags', fields: [{name: 'id', type: 'integer'}]},
      ];
      pgQueryMock.mockResolvedValueOnce({rows: [{id: 1}], rowCount: 1});

      const fastify = await createTestApp(pgConfig, emptyModel);

      const response = await fastify.inject({method: 'GET', url: '/tags/'});

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toHaveLength(1);

      await fastify.close();
    });

    test('should ignore unknown query params that do not match filter patterns', async () => {
      const fastify = await createTestApp(pgConfig, getAllModel);

      await fastify.inject({method: 'GET', url: '/users/?foo=bar'});

      // Should not have a WHERE clause for foo
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT $1 OFFSET $2;',
        [20, 0],
      );

      await fastify.close();
    });
  });
});
