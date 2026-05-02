import fastifyJwt from '@fastify/jwt';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    try {
      // In production, use process.env.JWT_SECRET instead of a hardcoded string
      await fastify.register(fastifyJwt, {
        secret: 'your-super-secret-key', // In production, use process.env.JWT_SECRET
      });
    } catch (err) {
      fastify.log.error(`Failed to connect to auth: ${err}`);
      throw err;
    }
  },
  {
    name: 'auth-plugin',
  },
);
