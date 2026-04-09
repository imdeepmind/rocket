import { expect, test, describe } from 'vitest';
import Fastify from 'fastify';
import responsePlugin from '../../src/plugin/response';

describe('response plugin', () => {
  test('response plugin decorates fastify with buildResponse', async () => {
    const fastify = Fastify();
    await fastify.register(responsePlugin);
    await fastify.ready();

    expect(fastify.hasDecorator('buildResponse')).toBe(true);
  });

  test('buildResponse returns a correctly structured response', async () => {
    const fastify = Fastify();
    await fastify.register(responsePlugin);
    await fastify.ready();

    const code = 200;
    const message = 'Success';
    const data = { id: 1, name: 'Test' };
    const raw_data = { debug: 'info' };

    const response = fastify.buildResponse(code, message, data, raw_data);

    expect(response).toEqual({
      code,
      message,
      data,
      raw_data,
    });
  });

  test('buildResponse works without optional raw_data', async () => {
    const fastify = Fastify();
    await fastify.register(responsePlugin);
    await fastify.ready();

    const code = 404;
    const message = 'Not Found';
    const data = null;

    const response = fastify.buildResponse(code, message, data);

    expect(response).toEqual({
      code,
      message,
      data,
      raw_data: undefined,
    });
  });
});
