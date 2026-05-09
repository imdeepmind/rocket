import '@fastify/jwt';
import 'fastify';

import type Redis from 'ioredis';

import {DatabaseQuery, StructuredResponse} from '@/interfaces';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
    };
  }
}

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
    jwt: import('@fastify/jwt').JWT;
  }
}
