import fastifyJwt from '@fastify/jwt';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(fastifyJwt, {
      secret: 'your-super-secret-key', // In production, use process.env.JWT_SECRET
    });
  },
  {
    name: 'auth-plugin',
  },
);
