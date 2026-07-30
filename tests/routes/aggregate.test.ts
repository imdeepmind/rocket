import {beforeEach, describe, expect, test} from 'vitest';

import {AuthenticationConfig, ModelConfig} from '@/interfaces/config';

import {pgClientQueryMock, pgQueryMock} from '@tests/helpers/db-mocks';
import {createTestApp, pgConfig} from '@tests/helpers/test-app';

const aggregateModel: Record<string, ModelConfig> = {
  sales: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      amount: {
        type: 'integer',
        aggregations: ['avg', 'max', 'min', 'sum', 'count'],
      },
      category: {
        type: 'string',
        aggregations: ['frequency'],
      },
      date: {type: 'string'}, // No aggregation
    },
  },
};

const upAuthConfig: AuthenticationConfig = {
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
    },
  },
};

describe('test aggregate api', () => {
  beforeEach(() => {
    pgQueryMock.mockClear();
    pgClientQueryMock.mockClear();
  });

  describe('happy path', () => {
    test('should return 200 with all numeric aggregations', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{avg: 50, max: 100, min: 10, sum: 500, count: 10}],
        }) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=avg,max,min,sum,count',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data.avg).toBe(50);
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
        url: '/v1/sales/aggregation/amount?operations=max,min',
      });

      expect(pgClientQueryMock).toHaveBeenCalledTimes(3);
      expect(pgClientQueryMock).toHaveBeenNthCalledWith(
        2,
        'SELECT MAX("amount") AS max, MIN("amount") AS min FROM "sales"',
        [],
      );

      await fastify.close();
    });

    test('should return 200 with frequency aggregation', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {val: 'electronics', c: '5'},
            {val: 'books', c: '12'},
          ],
        }) // frequency query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/category?operations=frequency',
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
        url: '/v1/sales/aggregation/category?operations=frequency',
      });

      expect(pgClientQueryMock).toHaveBeenCalledTimes(3);
      expect(pgClientQueryMock).toHaveBeenNthCalledWith(
        2,
        'SELECT "category" as val, COUNT(*) as c FROM "sales" GROUP BY "category"',
        [],
      );

      await fastify.close();
    });

    test('should handle combining numeric aggregations with frequency', async () => {
      // It will do two queries: one for numeric, one for frequency, if both are supported.
      // Wait, 'amount' does not support frequency in our config. Let's make a combined field locally.

      const combinedModel: Record<string, ModelConfig> = {
        stats: {
          fields: {
            score: {
              type: 'integer',
              aggregations: ['avg', 'frequency'],
            },
          },
        },
      };

      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{avg: 85}]}) // numeric aggregation
        .mockResolvedValueOnce({
          rows: [
            {val: 80, c: 2},
            {val: 90, c: 1},
          ],
        }) // frequency aggregation
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, combinedModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/stats/aggregation/score?operations=avg,frequency',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        avg: 85,
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
        url: '/v1/sales/aggregation/amount', // missing query param
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should return 400 when an empty operations string is provided', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=',
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
        url: '/v1/sales/aggregation/amount?operations=sum,frequency',
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
        url: '/v1/sales/aggregation/date?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should return 404 for an unknown model', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/nonexistent/aggregation/id?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should return 404 when the API is disabled in config', async () => {
      const disabledApiConfig = {
        'aggregate.v1.sales.amount.getAggregation': {enabled: false},
      };

      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        disabledApiConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should handle empty result sets gracefully for numeric aggregation', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=sum',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({});

      await fastify.close();
    });
  });

  describe('error handling during database operations', () => {
    test('should return 500 when aggregation query fails after BEGIN', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Query failed')) // aggregation query fails
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // ROLLBACK succeeds

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=sum',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should handle rollback failure gracefully after query error', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN succeeds
        .mockRejectedValueOnce(new Error('Query failed')) // aggregation query fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=sum',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });

    test('should return 500 when BEGIN itself fails', async () => {
      pgClientQueryMock.mockRejectedValueOnce(new Error('BEGIN failed')); // BEGIN fails

      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=sum',
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe('authentication', () => {
    const apisConfig = {
      'aggregate.v1.sales.amount.getAggregation': {
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
        url: '/v1/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{count: 10}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

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
        url: '/v1/sales/aggregation/amount?operations=count',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.count).toBe(10);
      await fastify.close();
    });
  });

  describe('supportedAggregations', () => {
    test('should use supportedAggregations from api config instead of field-level aggregations', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{count: 5, sum: 500}],
        }) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(pgConfig, aggregateModel, {
        'aggregate.v1.sales.amount.getAggregation': {
          supportedAggregations: ['count', 'sum'],
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=count,sum',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.count).toBe(5);
      expect(response.json().data.sum).toBe(500);

      await fastify.close();
    });

    test('should reject operations not in supportedAggregations', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel, {
        'aggregate.v1.sales.amount.getAggregation': {
          supportedAggregations: ['count'],
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=avg',
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    test('should use supportedAggregations with variant endpoints', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{min: 10, max: 100}],
        }) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        {
          'aggregate.admin.sales.amount.getAggregation': {
            supportedAggregations: ['min', 'max'],
          },
        },
        undefined,
        undefined,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=min,max',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.min).toBe(10);
      expect(response.json().data.max).toBe(100);

      await fastify.close();
    });
  });

  describe('API variants', () => {
    test('should register additional variant endpoint when apiVariants is configured', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{count: 5}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        undefined,
        undefined,
        undefined,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      // Test that the admin variant endpoint is accessible
      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.count).toBe(5);

      await fastify.close();
    });

    test('should register both default and variant endpoints', async () => {
      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        undefined,
        undefined,
        undefined,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      // Test default endpoint (with v1 prefix)
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{sum: 100}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const defaultResponse = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=sum',
      });

      expect(defaultResponse.statusCode).toBe(200);
      expect(defaultResponse.json().data.sum).toBe(100);

      // Test variant endpoint
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{sum: 200}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const variantResponse = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=sum',
      });

      expect(variantResponse.statusCode).toBe(200);
      expect(variantResponse.json().data.sum).toBe(200);

      await fastify.close();
    });

    test('should register multiple variant endpoints', async () => {
      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        undefined,
        undefined,
        undefined,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin', 'public'],
          },
        },
      );

      // Test admin variant
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{avg: 75}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const adminResponse = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=avg',
      });

      expect(adminResponse.statusCode).toBe(200);
      expect(adminResponse.json().data.avg).toBe(75);

      // Test public variant
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{avg: 65}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const publicResponse = await fastify.inject({
        method: 'GET',
        url: '/public/sales/aggregation/amount?operations=avg',
      });

      expect(publicResponse.statusCode).toBe(200);
      expect(publicResponse.json().data.avg).toBe(65);

      await fastify.close();
    });

    test('should not register variant endpoint when disabled in apis config', async () => {
      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        {
          'aggregate.admin.sales.amount.getAggregation': {
            enabled: false,
          },
        },
        undefined,
        undefined,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    test('should respect variant-specific authorization settings', async () => {
      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            authorization: false,
          },
          'aggregate.admin.sales.amount.getAggregation': {
            authorization: true,
          },
        },
        undefined,
        upAuthConfig,
        {
          'aggregate.v1.sales.amount.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      // Default endpoint should work without auth
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{count: 10}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const defaultResponse = await fastify.inject({
        method: 'GET',
        url: '/v1/sales/aggregation/amount?operations=count',
      });

      expect(defaultResponse.statusCode).toBe(200);

      // Admin variant should require auth
      const variantResponseNoAuth = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=count',
      });

      expect(variantResponseNoAuth.statusCode).toBe(401);

      // Admin variant with valid token should work
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({rows: [{count: 15}]}) // aggregation query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const token = fastify.jwt.sign({id: 1, email: 'admin@example.com'});

      const variantResponseWithAuth = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=count',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(variantResponseWithAuth.statusCode).toBe(200);
      expect(variantResponseWithAuth.json().data.count).toBe(15);

      await fastify.close();
    });

    test('should work with frequency aggregation on variant endpoints', async () => {
      pgClientQueryMock
        .mockResolvedValueOnce({rows: [], rowCount: 0}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {val: 'electronics', c: '8'},
            {val: 'furniture', c: '3'},
          ],
        }) // frequency query
        .mockResolvedValueOnce({rows: [], rowCount: 0}); // COMMIT

      const fastify = await createTestApp(
        pgConfig,
        aggregateModel,
        undefined,
        undefined,
        undefined,
        {
          'aggregate.v1.sales.category.getAggregation': {
            variants: ['admin'],
          },
        },
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/category?operations=frequency',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.frequency).toEqual({
        electronics: 8,
        furniture: 3,
      });

      await fastify.close();
    });

    test('should not register variant when apiVariants config is empty', async () => {
      const fastify = await createTestApp(pgConfig, aggregateModel);

      const response = await fastify.inject({
        method: 'GET',
        url: '/admin/sales/aggregation/amount?operations=count',
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});
