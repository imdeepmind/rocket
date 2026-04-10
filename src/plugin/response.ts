import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

import { StructuredResponse } from '../types';

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate(
    'buildResponse',
    <T = unknown, R = unknown>(
      code: number,
      message: string,
      data: T,
      raw_data?: R
    ): StructuredResponse<T, R> => {
      return {
        code,
        message,
        data,
        raw_data,
      };
    }
  );
});
