import Fastify from 'fastify';
import {describe, expect, test} from 'vitest';

import responsePlugin from '@/plugin/response';

describe('response plugin', () => {
  test('response plugin decorates fastify with buildResponse', async () => {
    const fastify = Fastify();
    await fastify.register(responsePlugin);
    await fastify.ready();

    expect(fastify.hasDecorator('buildResponse')).toBe(true);
  });

  test('buildResponse returns a correctly structured response without raw_data', async () => {
    const fastify = Fastify();
    await fastify.register(responsePlugin);
    await fastify.ready();

    const code = 200;
    const message = 'Success';
    const data = {id: 1, name: 'Test'};

    const response = fastify.buildResponse(code, message, data);

    expect(response).toEqual({
      code,
      message,
      data,
    });
    expect(response).not.toHaveProperty('raw_data');
    expect(Object.keys(response)).toEqual(['code', 'message', 'data']);
  });

  test('buildResponse works with null data', async () => {
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
    });
    expect(response).not.toHaveProperty('raw_data');
  });
});
