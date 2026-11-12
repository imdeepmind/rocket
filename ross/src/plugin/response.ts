import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {StructuredResponse} from '@/interfaces';

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate(
    'buildResponse',
    <T = unknown>(
      code: number,
      message: string,
      data: T,
    ): StructuredResponse<T> => {
      return {
        code,
        message,
        data,
      };
    },
  );
});
