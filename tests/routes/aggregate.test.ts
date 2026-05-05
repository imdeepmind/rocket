import {beforeEach, describe, expect, test} from 'vitest';

import {AuthConfig, ModelConfig} from '@/schema/config';

import {pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const aggregateModel: ModelConfig[] = [
  {
    name: 'sales',
    fields: [
      {name: 'id', type: 'integer', primaryKey: true},
      {
        name: 'amount',
        type: 'integer',
        supportedAggregation: ['mean', 'max', 'min', 'sum', 'count'],
      },
      {
        name: 'category',
        type: 'string',
        supportedAggregation: ['frequency'],
      },
      {name: 'date', type: 'string'}, // No aggregation
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

describe('test aggregate api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should return 200 with all numeric aggregations', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{mean: 50, max: 100, min: 10, sum: 500, count: 10}],
        rowCount: 1,
      });

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=mean,max,min,sum,count',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data.mean).toBe(50);
      expect(data.max).toBe(100);
      expect(data.min).toBe(10);
      expect(data.sum).toBe(500);
      expect(data.count).toBe(10);

      await fastify.close();
    });

    test('should build the correct SELECT SQL for numeric operations', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=max,min',
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT MAX("amount") AS max, MIN("amount") AS min FROM "sales"',
        [],
      );

      await fastify.close();
    });

    test('should return 200 with frequency aggregation', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {val: 'electronics', c: '5'},
          {val: 'books', c: '12'},
        ],
        rowCount: 2,
      });

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/category?operations=frequency',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.frequency).toEqual({
        electronics: 5,
        books: 12,
      });

      await fastify.close();
    });

    test('should build the correct GROUP BY SQL for frequency', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/category?operations=frequency',
      });

      expect(pgQueryMock).toHaveBeenCalledOnce();
      expect(pgQueryMock).toHaveBeenCalledWith(
        'SELECT "category" as val, COUNT(*) as c FROM "sales" GROUP BY "category"',
        [],
      );

      await fastify.close();
    });

    test('should handle combining numeric aggregations with frequency', async () => {
      // It will do two queries: one for numeric, one for frequency, if both are supported.
      // Wait, 'amount' does not support frequency in our config. Let's make a combined field locally.

      const combinedModel: ModelConfig[] = [
        {
          name: 'stats',
          fields: [
            {
              name: 'score',
              type: 'integer',
              supportedAggregation: ['mean', 'frequency'],
            },
          ],
        },
      ];

      // First call: numeric aggregation
      pgQueryMock.mockResolvedValueOnce({
        rows: [{mean: 85}],
        rowCount: 1,
      });
      // Second call: frequency aggregation
      pgQueryMock.mockResolvedValueOnce({
        rows: [
          {val: 80, c: 2},
          {val: 90, c: 1},
        ],
        rowCount: 2,
      });

      const fastify = await createTestApp(pgConfig, combinedModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/stats/aggregation/score?operations=mean,frequency',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        mean: 85,
        frequency: {'80': 2, '90': 1},
      });

      await fastify.close();
    });
  });

  describe('error handling and validation', () => {
    test('should return 400 when no operations are provided', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount', // missing query param
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should return 400 when an empty operations string is provided', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain(
        'At least one aggregation operation must be provided',
      );

      await fastify.close();
    });

    test('should return 400 for unsupported operation', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=sum,frequency',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        "Unsupported aggregation operation 'frequency' for field amount",
      );

      await fastify.close();
    });
  });

  describe('edge cases', () => {
    test('should return 404 for fields without supportedAggregation', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/date?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should return 404 for an unknown model', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/nonexistent/aggregation/id?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should handle empty result sets gracefully for numeric aggregation', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=sum',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({});

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'aggregate->sales->get_aggregation': {
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided', async () => {
      pgQueryMock.mockResolvedValueOnce({
        rows: [{count: 10}],
        rowCount: 1,
      });

      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        apisConfig,
        undefined,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'GET',
        url: '/sales/aggregation/amount?operations=count',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.count).toBe(10);
      await fastify.close();
    });
  });
});
