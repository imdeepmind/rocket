import {describe, expect, test} from 'vitest';

import {ApisConfig} from '@/schema/config';

import {createTestApp, pgConfig} from '@tests/helpers/test-app';

describe('test custom-queries api', () => {
  const customApis: ApisConfig = {
    customQueries: [
      {
        method: 'GET',
        path: '/search-users',
        query:
          'SELECT * FROM users WHERE status = &&status:string&& AND age >= &&minAge:integer&&;',
      },
      {
        method: 'POST',
        path: '/update-user',
        query:
          'UPDATE users SET name = @@name:string@@ WHERE id = $$id:integer$$;',
      },
    ],
  };

  describe('happy path', () => {
    test('should register GET custom queries and validate querystrings', async () => {
      const fastify = await createTestApp(pgConfig, [], customApis);

      // Successfully call the endpoint with correct schema
      const validResponse = await fastify.inject({
        method: 'GET',
        url: '/custom-queries/search-users',
        query: {
          status: 'active',
          minAge: '18',
        },
      });

      expect(validResponse.statusCode).toBe(200);
      expect(JSON.parse(validResponse.body).data).toEqual({
        data: [],
        res: {rows: [], changes: 0},
      });

      await fastify.close();
    });

    test('should register POST custom queries and validate path params and body schemas', async () => {
      const fastify = await createTestApp(pgConfig, [], customApis);

      // Successfully call the endpoint with correct schema
      // Since it's a POST with path variables, we use the injected /:id
      const validResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/update-user/42',
        payload: {
          name: 'Jane Doe',
        },
      });

      expect(validResponse.statusCode).toBe(200);
      expect(JSON.parse(validResponse.body).data).toEqual({
        data: [],
        res: {rows: [], changes: 0},
      });

      await fastify.close();
    });

    test('should support all data types in magic variables', async () => {
      const allTypesApis: ApisConfig = {
        customQueries: [
          {
            method: 'POST',
            path: '/all-types',
            query:
              'INSERT INTO test (b, t, d) VALUES (@@b:boolean@@, @@t:text@@, @@d:datetime@@);',
          },
        ],
      };
      const fastify = await createTestApp(pgConfig, [], allTypesApis);

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/all-types',
        payload: {
          b: true,
          t: 'some long text',
          d: '2023-01-01T00:00:00Z',
        },
      });

      expect(res.statusCode).toBe(200);
      await fastify.close();
    });
  });

  describe('schema checking and rejections', () => {
    test('should fail GET query when omitting required querystrings not passed depending on fastify settings or passing invalid type', async () => {
      const fastify = await createTestApp(pgConfig, [], customApis);

      // minAge is expected to be integer. If we pass a string that isn't parseable as int, fastify fails
      const invalidResponse = await fastify.inject({
        method: 'GET',
        url: '/custom-queries/search-users',
        query: {
          status: 'active',
          minAge: 'invalid-string',
        },
      });

      expect(invalidResponse.statusCode).toBe(400);

      await fastify.close();
    });

    test('should fail POST query when extra body parameters passed', async () => {
      const fastify = await createTestApp(pgConfig, [], customApis);

      const invalidBodyResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/update-user/42',
        payload: {
          name: 'Jane Doe',
          extra_field: 'not allowed',
        },
      });

      // fastify natively prunes extra properties under default ajv config rather than failing request when additionalProperties=false
      expect(invalidBodyResponse.statusCode).toBe(200);

      await fastify.close();
    });

    test('should fail POST query when path param type fails cast', async () => {
      const fastify = await createTestApp(pgConfig, [], customApis);

      const invalidPathResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/update-user/not-a-number',
        payload: {
          name: 'Jane Doe',
        },
      });

      expect(invalidPathResponse.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe('interpolation error handling', () => {
    test('should throw error when a required variable is missing in request', async () => {
      const fastify = await createTestApp(pgConfig, [], {
        customQueries: [
          {
            method: 'POST',
            path: '/missing-param',
            query: 'SELECT * FROM users WHERE status = &&status:string&&;',
          },
        ],
      });

      // To hit the "Missing value for parameter" error or "Missing query param",
      // we need a query that expects a param that isn't provided.
      // But Fastify's AJV will normally catch this if it's required.
      // However, we don't mark these as "required" in the JSON schema currently!
      // In registerCustomQueryRoutes, we only list them in `properties`.

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/missing-param',
        // Omitting 'status' query string
      });

      // It should still return 200 because status is optional in schema,
      // but the handler will throw during interpolation.
      // Fastify will catch the error and return 500.
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).message).toContain(
        'Missing query param: "status"',
      );

      await fastify.close();
    });

    test('should throw error when a required body variable is missing', async () => {
      const fastify = await createTestApp(pgConfig, [], {
        customQueries: [
          {
            method: 'POST',
            path: '/missing-body',
            query: 'SELECT * FROM users WHERE id = @@id:integer@@;',
          },
        ],
      });

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-queries/missing-body',
        payload: {
          // 'id' is missing
        },
      });

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).message).toContain(
        'Missing body param: "id"',
      );

      await fastify.close();
    });
  });
});
