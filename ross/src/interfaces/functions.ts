import {FastifyInstance, FastifyRequest} from 'fastify';

export type CustomFunctionHandler<
  TRequest = FastifyRequest,
  TApp = FastifyInstance,
  TOutput = unknown,
> = (request: TRequest, app: TApp) => Promise<TOutput> | TOutput;
