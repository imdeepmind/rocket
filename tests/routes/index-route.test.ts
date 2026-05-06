import {beforeEach, describe, expect, test} from 'vitest';

import {AuthConfig, ModelConfig} from '@/interfaces/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

// Model with a unique (primaryKey) field — returns single record
const uniqueFieldModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {name: 'name', type: 'string'},
      {name: 'email', type: 'string'},
    ],
  },
];

// Model with a unique but non-PK field
const uniqueNonPkModel: ModelConfig[] = [
  {
    name: 'users',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {name: 'email', type: 'string', unique: true},
    ],
  },
];

// Model with an indexable (non-unique) field — returns array
const indexableFieldModel: ModelConfig[] = [
  {
    name: 'posts',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: [
          'sortable',
          'equal',
          'lessThan',
          'greaterThan',
          'lessThanEqual',
          'greaterThanEqual',
          'oneOf',
        ],
      },
      {
        name: 'category',
        type: 'string',
        supportedOperations: ['indexable', 'sortable', 'equal'],
      },
      {
        name: 'title',
        type: 'string',
        supportedOperations: ['sortable', 'equal'],
      },
    ],
  },
];

// Model with both unique and indexable fields
const mixedFieldModel: ModelConfig[] = [
  {
    name: 'articles',
    fields: [
      {
        name: 'id',
        type: 'integer',
        primaryKey: true,
        supportedOperations: [
          'sortable',
          'equal',
          'lessThan',
          'greaterThan',
          'lessThanEqual',
          'greaterThanEqual',
          'oneOf',
        ],
      },
      {name: 'slug', type: 'string', unique: true},
      {
        name: 'tag',
        type: 'string',
        supportedOperations: ['indexable', 'sortable', 'equal'],
      },
    ],
  },
];

// Model with no index-eligible fields
const noIndexFieldModel: ModelConfig[] = [
  {
    name: 'logs',
    fields: [
      {name: 'message', type: 'string'},
      {name: 'level', type: 'string'},
    ],
  },
];

const upAuthConfig: AuthConfig = {
  enableAuth: true,
  authEngine: 'up-auth',
  authModel: {
    modelName: 'users',
    idColumn: 'id',
    usernameColumn: 'email',
    passwordColumn: 'password',
  },
};

describe('test index-route api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
  });

  describe('unique field routes (primaryKey / unique)', () => {
    test('should return 200 with a single record for primaryKey lookup', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 42, name: 'Alice', email: 'alice@example.com'}],
        rowCount: 1,
      });

      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/42',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual({
        id: 42,
        name: 'Alice',
        email: 'alice@example.com',
      });

      await fastify.close();
    });

    test('should build correct SQL with LIMIT 1 for primaryKey field', async () => {
      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      await fastify.inject({method: 'GET', url: '/users/id/5'});

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "id" = $1 LIMIT $2;',
        [5, 1],
      );

      await fastify.close();
    });

    test('should return null in data when no record is found for a unique field', async () => {
      pgQueryMock.mockResolvedValueOnce({rows: [], rowCount: 0});

      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/999',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toBeNull();

      await fastify.close();
    });

    test('should not include pagination in response for unique field', async () => {
      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/1',
      });

      expect(response.json().data).not.toHaveProperty('pagination');

      await fastify.close();
    });

    test('should also register route for a unique (non-PK) field', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 1, email: 'bob@example.com'}],
        rowCount: 1,
      });

      const fastify = await createTestApp(pgConfig, uniqueNonPkModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/email/bob@example.com',
      });

      expect(response.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "email" = $1 LIMIT $2;',
        ['bob@example.com', 1],
      );

      await fastify.close();
    });

    test('should include correct message in the response for unique field', async () => {
      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/1',
      });

      expect(response.json().message).toBe(
        'Successfully retrieved records from the users table',
      );

      await fastify.close();
    });
  });

  describe('indexable field routes (non-unique, returns array)', () => {
    test('should return 200 with an array of records for an indexable field', async () => {
      pgQueryMock
        .mockResolvedValueOnce({rows: [{total: 2}]})
        .mockResolvedValueOnce({
          rows: [
            {id: 1, category: 'tech', title: 'Post A'},
            {id: 2, category: 'tech', title: 'Post B'},
          ],
          rowCount: 2,
        });

      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([
        {id: 1, category: 'tech', title: 'Post A'},
        {id: 2, category: 'tech', title: 'Post B'},
      ]);

      await fastify.close();
    });

    test('should build correct SQL with WHERE + LIMIT/OFFSET for indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 LIMIT $2 OFFSET $3;',
        ['tech', 20, 0],
      );

      await fastify.close();
    });

    test('should include pagination in the response for an indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?page=2&limit=15',
      });

      expect(response.json().data.pagination).toEqual({
        page: 2,
        limit: 15,
        total: 0,
      });

      await fastify.close();
    });

    test('should use custom page and limit in SQL for indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?page=3&limit=10',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 LIMIT $2 OFFSET $3;',
        ['tech', 10, 20], // offset = (3-1) * 10 = 20
      );

      await fastify.close();
    });

    test('should apply additional _eq filter on top of the path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?title_eq=Post+A',
      });

      const callArgs = pgQueryMock.mock.calls[1];
      expect(callArgs[0]).toContain('"category" = $1');
      expect(callArgs[0]).toContain('"title" = $2');
      expect(callArgs[0]).toContain('AND');

      await fastify.close();
    });

    test('should apply ORDER BY ASC for indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?orderBy=title',
      });

      expect(response.statusCode).toBe(200);
      const callArgs = pgQueryMock.mock.calls[1];
      expect(callArgs[0]).toContain('ORDER BY "title" ASC');

      await fastify.close();
    });

    test('should apply ORDER BY DESC for indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?orderBy=category&orderDir=desc',
      });

      const callArgs = pgQueryMock.mock.calls[1];
      expect(callArgs[0]).toContain('ORDER BY "category" DESC');

      await fastify.close();
    });

    test('should return empty array when no rows match for an indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/posts/category/nonexistent',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data).toEqual([]);

      await fastify.close();
    });

    test('should apply _lt filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_lt=100',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 AND "id" < $2 LIMIT $3 OFFSET $4;',
        ['tech', 100, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _lte filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_lte=50',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 AND "id" <= $2 LIMIT $3 OFFSET $4;',
        ['tech', 50, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gt filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_gt=10',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 AND "id" > $2 LIMIT $3 OFFSET $4;',
        ['tech', 10, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _gte filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_gte=1',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 AND "id" >= $2 LIMIT $3 OFFSET $4;',
        ['tech', 1, 20, 0],
      );

      await fastify.close();
    });

    test('should apply _in filter alongside path param', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_in=1,2,3',
      });

      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "category" = $1 AND "id" IN ($2, $3, $4) LIMIT $5 OFFSET $6;',
        ['tech', '1', '2', '3', 20, 0],
      );

      await fastify.close();
    });

    test('should combine path param with multiple query filters', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);

      await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech?id_gt=10&title_eq=Hello',
      });

      const callArgs = pgQueryMock.mock.calls[1];
      expect(callArgs[0]).toContain('"category" = $1');
      expect(callArgs[0]).toContain('"id" > $2');
      expect(callArgs[0]).toContain('"title" = $3');
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1]).toEqual(['tech', 10, 'Hello', 20, 0]);

      await fastify.close();
    });
  });

  describe('mixed model (unique + indexable fields)', () => {
    test('should register separate routes for unique and indexable fields', async () => {
      const fastify = await createTestApp(pgConfig, mixedFieldModel);

      // unique route: /articles/id/:id
      const byId = await fastify.inject({method: 'GET', url: '/articles/id/1'});
      expect(byId.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'SELECT * FROM "articles" WHERE "id" = $1 LIMIT $2;',
        [1, 1],
      );

      pgQueryMock.mockClear();

      // unique route: /articles/slug/:slug
      const bySlug = await fastify.inject({
        method: 'GET',
        url: '/articles/slug/my-article',
      });
      expect(bySlug.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'SELECT * FROM "articles" WHERE "slug" = $1 LIMIT $2;',
        ['my-article', 1],
      );

      pgQueryMock.mockClear();

      // indexable route: /articles/tag/:tag
      const byTag = await fastify.inject({
        method: 'GET',
        url: '/articles/tag/news',
      });
      expect(byTag.statusCode).toBe(200);
      expect(pgQueryMock).toHaveBeenLastCalledWith(
        'SELECT * FROM "articles" WHERE "tag" = $1 LIMIT $2 OFFSET $3;',
        ['news', 20, 0],
      );

      await fastify.close();
    });
  });

  describe('error handling', () => {
    test('should return 500 when database query throws for unique field', async () => {
      const fastify = await createTestApp(pgConfig, uniqueFieldModel);
      pgQueryMock.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/1',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when database query throws for indexable field', async () => {
      const fastify = await createTestApp(pgConfig, indexableFieldModel);
      pgQueryMock.mockRejectedValueOnce(new Error('DB down'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/posts/category/tech',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 when model has no index-eligible fields', async () => {
      const fastify = await createTestApp(pgConfig, noIndexFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/logs/message/hello',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });

    test('should return 404 for a completely unknown model', async () => {
      const fastify = await createTestApp(pgConfig, uniqueFieldModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/nonexistent/id/1',
      });

      expect(response.statusCode).toBe(404);
      expect(pgQueryMock).not.toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'modelAPIs->index->users': {
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        uniqueFieldModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/42',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{id: 42, name: 'Alice', email: 'alice@example.com'}],
        rowCount: 1,
      });

      const fastify = await createTestApp(
        pgConfig,
        uniqueFieldModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'GET',
        url: '/users/id/42',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.data.id).toBe(42);
      await fastify.close();
    });
  });
});
