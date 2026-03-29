import 'fastify';
import { DatabaseQuery } from '.';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseQuery;
  }
}
