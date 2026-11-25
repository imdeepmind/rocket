import { FastifyInstance } from 'fastify';
/**
 * Registers SIGINT and SIGTERM handlers to gracefully close the Fastify application.
 */
export declare function setupGracefulShutdown(app: FastifyInstance): void;
