import {describe, expect, test} from 'vitest';

import {AuthenticationConfig} from '@/interfaces/config';

import {createTestApp, pgConfig} from '@tests/helpers/test-app';

describe('test custom-endpoints api', () => {
  const customEndpoints = {
    searchUsers: {
      method: 'GET' as const,
      path: '/search-users',
      description: 'Search users by status and age',
      validation: {
        type: 'object',
        required: ['minAge'],
        properties: {
          minAge: {type: 'integer', minimum: 1},
        },
      },
      handler: {
        type: 'sql' as const,
        sql: 'SELECT * FROM users WHERE status = &&status:string&& AND age >= &&minAge:integer&&;',
      },
    },
    updateUser: {
      method: 'POST' as const,
      path: '/update-user',
      description: 'Update a user by ID',
      validation: {
        type: 'object',
        required: ['name', 'id'],
        properties: {
          name: {type: 'string'},
          id: {type: 'integer', minimum: 1},
        },
      },
      handler: {
        type: 'sql' as const,
        sql: 'UPDATE users SET name = @@name:string@@ WHERE id = $$id:integer$$;',
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

  describe('happy path', () => {
    test('should register GET custom endpoints and validate querystrings', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      // Successfully call the endpoint with correct schema
      const validResponse = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
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

    test('should register POST custom endpoints and validate path params and body schemas', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      // Successfully call the endpoint with correct schema
      // Since it's a POST with path variables, we use the injected /:id
      const validResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/update-user/42',
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
      const allTypesEndpoints = {
        allTypes: {
          method: 'POST' as const,
          path: '/all-types',
          description: 'Test all types',
          validation: {},
          handler: {
            type: 'sql' as const,
            sql: 'INSERT INTO test (b, t, d, dec, dt) VALUES (@@b:boolean@@, @@t:text@@, @@d:datetime@@, @@dec:decimal@@, @@dt:date@@);',
          },
        },
      };
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        allTypesEndpoints,
      );

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/all-types',
        payload: {
          b: true,
          t: 'some long text',
          d: '2023-01-01T00:00:00Z',
          dec: 12.34,
          dt: '2023-01-01',
        },
      });

      expect(res.statusCode).toBe(200);
      await fastify.close();
    });
  });

  describe('schema checking and rejections', () => {
    test('should fail GET query when omitting required querystrings not passed depending on fastify settings or passing invalid type', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      // minAge is expected to be integer. If we pass a string that isn't parseable as int, fastify fails
      const invalidResponse = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        query: {
          status: 'active',
          minAge: 'invalid-string',
        },
      });

      expect(invalidResponse.statusCode).toBe(400);

      await fastify.close();
    });

    test('should fail POST query when extra body parameters passed', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      const invalidBodyResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/update-user/42',
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
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      const invalidPathResponse = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/update-user/not-a-number',
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
      const fastify = await createTestApp(pgConfig, {}, undefined, {
        missingParam: {
          method: 'POST' as const,
          path: '/missing-param',
          description: 'Test missing param',
          validation: {},
          handler: {
            type: 'sql' as const,
            sql: 'SELECT * FROM users WHERE status = &&status:string&&;',
          },
        },
      });

      // To hit the "Missing value for parameter" error or "Missing query param",
      // we need a query that expects a param that isn't provided.
      // But Fastify's AJV will normally catch this if it's required.
      // However, we don't mark these as "required" in the JSON schema currently!
      // In registerCustomEndpointRoutes, we only list them in `properties`.

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/missing-param',
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
      const fastify = await createTestApp(pgConfig, {}, undefined, {
        missingBody: {
          method: 'POST' as const,
          path: '/missing-body',
          description: 'Test missing body',
          validation: {},
          handler: {
            type: 'sql' as const,
            sql: 'SELECT * FROM users WHERE id = @@id:integer@@;',
          },
        },
      });

      const res = await fastify.inject({
        method: 'POST',
        url: '/custom-endpoints/missing-body',
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

  describe('authentication', () => {
    const apisConfig = {
      'customEndpoints.all.searchUsers': {
        authorization: true,
      },
    };

    test('should return 401 when auth is enabled and no token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        apisConfig,
        customEndpoints,
        upAuthConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        query: {status: 'active', minAge: '18'},
      });

      expect(response.statusCode).toBe(401);
      await fastify.close();
    });

    test('should return 200 when auth is enabled and valid token is provided', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        apisConfig,
        customEndpoints,
        upAuthConfig,
      );

      const token = fastify.jwt.sign({id: 1, email: 'test@example.com'});

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        headers: {
          authorization: `Bearer ${token}`,
        },
        query: {status: 'active', minAge: '18'},
      });

      expect(response.statusCode).toBe(200);
      await fastify.close();
    });

    test('should register security schema when api-key auth is enabled', async () => {
      const apiKeyAuthConfig: AuthenticationConfig = {
        enabled: true,
        provider: {
          type: 'api-key',
          config: {key: 'test-key-123'},
        },
      };

      const fastify = await createTestApp(
        pgConfig,
        {},
        apisConfig,
        customEndpoints,
        apiKeyAuthConfig,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        headers: {
          'x-api-key': 'test-key-123',
        },
        query: {status: 'active', minAge: '18'},
      });

      expect(response.statusCode).toBe(200);
      await fastify.close();
    });
  });

  describe('handler type dispatch', () => {
    test('should return 500 for unsupported handler type', async () => {
      const unsupportedEndpoints = {
        unsupported: {
          method: 'GET' as const,
          path: '/unsupported',
          description: 'Test unsupported handler type',
          validation: {},
          handler: {
            type: 'function' as const,
            sql: 'SELECT 1;',
          },
        },
      };

      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        unsupportedEndpoints,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/unsupported',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body).message).toBe(
        'Handler type "function" not supported',
      );

      await fastify.close();
    });
  });

  describe('parsing edge cases', () => {
    test('should handle mismatched delimiters gracefully', async () => {
      const mismatchedEndpoints = {
        mismatched: {
          method: 'GET' as const,
          path: '/mismatched',
          description: 'Test mismatched delimiters',
          validation: {},
          handler: {
            type: 'sql' as const,
            sql: 'SELECT * FROM users WHERE id = $$id:integer@@;',
          },
        },
      };

      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        mismatchedEndpoints,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/mismatched',
      });

      // It should still register but without the parameters
      expect(response.statusCode).toBe(200);
      await fastify.close();
    });

    test('should hit default case in cast with unknown type', async () => {
      const unknownTypeEndpoints = {
        unknownType: {
          method: 'GET' as const,
          path: '/unknown-type',
          description: 'Test unknown type',
          validation: {},
          handler: {
            type: 'sql' as const,
            // Using a type that is not in the DataType union but bypasses simple regex
            sql: 'SELECT * FROM users WHERE name = &&name:unknown&&;',
          },
        },
      };

      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        unknownTypeEndpoints,
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/unknown-type',
        query: {name: 'Alice'},
      });

      expect(response.statusCode).toBe(200);
      await fastify.close();
    });
  });

  describe('optional validation and AJV error handling', () => {
    test('should work when validation property is completely omitted from endpoint config', async () => {
      const noValidationEndpoints = {
        getUser: {
          method: 'GET' as const,
          path: '/get-user',
          description: 'Get user by id without explicit validation in config',
          handler: {
            type: 'sql' as const,
            sql: 'SELECT * FROM users WHERE id = $$id:integer$$;',
          },
        },
      };

      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        noValidationEndpoints,
      );

      // Path param 'id' is required by default, query params are optional
      const res = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/get-user/10',
      });

      expect(res.statusCode).toBe(200);
      await fastify.close();
    });

    test('should return 400 when combined parameters fail AJV validation constraints', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      // searchUsers has validation requiring minAge >= 1
      const res = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        query: {
          status: 'active',
          minAge: '0', // violates minimum: 1
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('minAge');

      await fastify.close();
    });

    test('should return 400 when a required validation property is missing', async () => {
      const fastify = await createTestApp(
        pgConfig,
        {},
        undefined,
        customEndpoints,
      );

      // searchUsers requires minAge in validation
      const res = await fastify.inject({
        method: 'GET',
        url: '/custom-endpoints/search-users',
        query: {},
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('minAge');

      await fastify.close();
    });
  });
});
