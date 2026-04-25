import {DatabaseQuery, StructuredResponse} from '@/schema';

import 'fastify';

import type Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseQuery;
    buildResponse: <T = unknown, R = unknown>(
      code: number,
      message: string,
      data: T,
      raw_data?: R,
    ) => StructuredResponse<T, R>;
    redis?: Redis;
  }
}
