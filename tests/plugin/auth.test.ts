import Fastify from 'fastify';
import {describe, expect, it} from 'vitest';

import authPlugin from '@/plugin/auth';

describe('Auth Plugin', () => {
  it('should register @fastify/jwt and expose jwt decorator', async () => {
    const app = Fastify();
    await app.register(authPlugin);
    await app.ready();

    expect(app.jwt).toBeDefined();
    expect(typeof app.jwt.sign).toBe('function');
    expect(typeof app.jwt.verify).toBe('function');
  });

  it('should be able to sign and verify a token', async () => {
    const app = Fastify();
    await app.register(authPlugin);
    await app.ready();

    const payload = {id: 1, email: 'test@example.com'};
    const token = app.jwt.sign(payload);
    expect(token).toBeDefined();

    const decoded = app.jwt.verify(token) as typeof payload;
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });
});
