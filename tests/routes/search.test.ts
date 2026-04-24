import {beforeEach, describe, expect, test} from 'vitest';

import {ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

// Model with a single searchable field
const searchableModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: [
          'equal',
          'lessThan',
          'greaterThan',
          'lessThanEqual',
          'greaterThanEqual',
          'oneOf',
        ],
      },
      {
        name: 'name',
        type: 'string',
        supportedOperations: ['searchable', 'sortable', 'equal'],
      },
      {name: 'email', type: 'string', supportedOperations: ['equal']},
    ],
  },
];

// Model with multiple searchable fields
const multiSearchableModel: ModelConfig[] = [
  {
    name: 'products',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {
        name: 'title',
        type: 'string',
        supportedOperations: ['searchable', 'sortable'],
      },
      {
        name: 'description',
        type: 'string',
        supportedOperations: ['searchable'],
      },
    ],
  },
];

// Model with no searchable fields
const noSearchableModel: ModelConfig[] = [
  {
    name: 'logs',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {name: 'message', type: 'string'},
    ],
  },
];

describe('test search api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should return 200 with matching records', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 1, name: 'Alice', email: 'alice@example.com'}],
        rowCount: 1,
      });

      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=alice',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([
        {id: 1, name: 'Alice', email: 'alice@example.com'},
      ]);

      await fastify.close();
    });

    test('should build correct LIKE SQL query with lowercase pattern', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=Alice',
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE $1 LIMIT $2 OFFSET $3;',
        ['%alice%', 20, 0],
      );

      await fastify.close();
    });

    test('should return 200 with empty array when no records match', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=zzznomatch',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([]);

      await fastify.close();
    });

    test('should include correct message in the response', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=test',
      });

      expect(response.json().message).toBe(
        'Successfully searched records from the users table',
      );

      await fastify.close();
    });

    test('should include default pagination in the response', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=test',
      });

      expect(response.json().data.pagination).toEqual({page: 1, limit: 20});

      await fastify.close();
    });
  });

  describe('pagination', () => {
    test('should use custom page and limit values', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&page=2&limit=15',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE $1 LIMIT $2 OFFSET $3;',
        ['%al%', 15, 15],
      );

      await fastify.close();
    });

    test('should clamp page to 1 when page=0 is supplied', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&page=0&limit=10',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE $1 LIMIT $2 OFFSET $3;',
        ['%al%', 10, 0],
      );

      await fastify.close();
    });

    test('should return correct pagination values in response body', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=bob&page=3&limit=10',
      });

      expect(response.json().data.pagination).toEqual({page: 3, limit: 10});

      await fastify.close();
    });
  });

  describe('filtering', () => {
    test('should combine LIKE with an _eq filter', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=ali&email_eq=alice@example.com',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('LOWER("name") LIKE $1');
      expect(callArgs[0]).toContain('"email" = $2');
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1]).toContain('%ali%');
      expect(callArgs[1]).toContain('alice@example.com');

      await fastify.close();
    });

    test('should apply _lt filter alongside LIKE', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&id_lt=100',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"id" < $2');
      expect(callArgs[1][1]).toBe(100);

      await fastify.close();
    });

    test('should apply _gt filter alongside LIKE', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&id_gt=0',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"id" > $2');
      expect(callArgs[1][1]).toBe(0);

      await fastify.close();
    });

    test('should apply _gte filter alongside LIKE', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&id_gte=1',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"id" >= $2');
      expect(callArgs[1][1]).toBe(1);

      await fastify.close();
    });

    test('should apply _lte filter alongside LIKE', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&id_lte=50',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"id" <= $2');
      expect(callArgs[1][1]).toBe(50);

      await fastify.close();
    });

    test('should apply _in filter alongside LIKE', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&id_in=1,2,3',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('"id" IN ($2, $3, $4)');
      expect(callArgs[1][1]).toBe('1');
      expect(callArgs[1][2]).toBe('2');
      expect(callArgs[1][3]).toBe('3');

      await fastify.close();
    });
  });

  describe('sorting', () => {
    test('should apply ORDER BY ASC when orderBy is set', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&orderBy=name',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY "name" ASC');

      await fastify.close();
    });

    test('should apply ORDER BY DESC when orderDir=desc', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al&orderBy=name&orderDir=desc',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY "name" DESC');

      await fastify.close();
    });

    test('should not add ORDER BY when orderBy is absent', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=al',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      expect(callArgs[0]).not.toContain('ORDER BY');

      await fastify.close();
    });
  });

  describe('multiple searchable fields', () => {
    test('should register separate search routes for each searchable field', async () => {
      const fastify = await createTestApp(pgConfig, multiSearchableModel);

      // Search by title
      const byTitle = await fastify.inject({
        method: 'GET',
        url: '/products/search/title?title_search=rocket',
      });
      expect(byTitle.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'SELECT * FROM "products" WHERE LOWER("title") LIKE $1 LIMIT $2 OFFSET $3;',
        ['%rocket%', 20, 0],
      );

      pgQueryMock.mockClear();

      // Search by description
      const byDescription = await fastify.inject({
        method: 'GET',
        url: '/products/search/description?description_search=fast',
      });
      expect(byDescription.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'SELECT * FROM "products" WHERE LOWER("description") LIKE $1 LIMIT $2 OFFSET $3;',
        ['%fast%', 20, 0],
      );

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 500 when database query throws', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);
      pgQueryMock.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=test',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 when model has no searchable fields', async () => {
      const fastify = await createTestApp(pgConfig, noSearchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/logs/search/message?message_search=error',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 404 for an unknown model', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/nonexistent/search/name?name_search=test',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should treat empty search term as a wildcard that matches everything', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      // empty search term becomes %%
      expect(callArgs[1][0]).toBe('%%');

      await fastify.close();
    });

    test('should ignore unrecognized filter operator patterns', async () => {
      const fastify = await createTestApp(pgConfig, searchableModel);

      await fastify.inject({
        method: 'GET',
        url: '/users/search/name?name_search=alice&name_contains=foo',
      });

      const callArgs = pgQueryMock.mock.calls[0];
      // Only the LIKE clause should appear, not any clause for `name_contains`
      expect(callArgs[0]).toBe(
        'SELECT * FROM "users" WHERE LOWER("name") LIKE $1 LIMIT $2 OFFSET $3;',
      );

      await fastify.close();
    });
  });
});
