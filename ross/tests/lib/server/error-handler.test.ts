import Fastify, {FastifyError, FastifyInstance} from 'fastify';
import {describe, expect, test} from 'vitest';

import responsePlugin from '@/plugin/response';

import {
  registerErrorHandler,
  registerNotFoundHandler,
} from '@/lib/server/error-handler';

describe('error-handler', () => {
  const buildApp = async (): Promise<FastifyInstance> => {
    const app = Fastify();
    registerErrorHandler(app);
    registerNotFoundHandler(app);
    await app.register(responsePlugin);
    return app;
  };

  describe('registerErrorHandler', () => {
    test('should format schema validation errors as 400 envelope without leaking internals', async () => {
      const app = await buildApp();
      app.post(
        '/validate',
        {
          schema: {
            body: {
              type: 'object',
              required: ['password'],
              properties: {password: {type: 'string'}},
            },
          },
        },
        async () => ({success: true}),
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/validate',
        payload: {username: 'someone'},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        code: 400,
        message: "body must have required property 'password'",
        data: null,
      });
      await app.close();
    });

    test('should send err.body directly when present on the error object', async () => {
      const app = await buildApp();
      app.post('/custom-body', async () => {
        throw Object.assign(new Error('Invalid existing password'), {
          statusCode: 401,
          body: {
            code: 401,
            message: 'Invalid existing password',
            data: null,
          },
        });
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/custom-body',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 401,
        message: 'Invalid existing password',
        data: null,
      });
      await app.close();
    });

    test('should translate database errors into safe envelopes', async () => {
      const app = await buildApp();
      app.post('/db-error', async () => {
        const err = new Error('duplicate key') as FastifyError & {
          code?: string;
          detail?: string;
        };
        err.code = '23505';
        err.detail = 'Key (email)=(test@example.com) already exists.';
        throw err;
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/db-error',
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        code: 409,
        message: 'Email already exists',
        data: null,
      });
      await app.close();
    });

    test('should map general errors to standard envelope without leaking internals', async () => {
      const app = await buildApp();
      app.get('/unhandled', async () => {
        throw new Error('Something went wrong');
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/unhandled',
      });

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        code: 500,
        message: 'Something went wrong',
        data: null,
      });
      await app.close();
    });
  });

  describe('registerNotFoundHandler', () => {
    test('should return standard 404 envelope for unmatched routes', async () => {
      const app = await buildApp();
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent-route',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        code: 404,
        message: 'Route GET:/api/v1/non-existent-route not found',
        data: null,
      });
      await app.close();
    });
  });
});
