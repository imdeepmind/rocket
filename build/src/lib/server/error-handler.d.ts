import { FastifyInstance } from 'fastify';
/**
 * Installs the framework error handler.
 *
 * This MUST be called before any route is registered: Fastify resolves the
 * error handler when routes are added, so registering it afterwards leaves
 * every route on the default Fastify error handler (which leaks raw driver
 * errors to clients).
 */
export declare function registerErrorHandler(app: FastifyInstance): void;
/**
 * Installs the framework 404 not found handler.
 *
 * Ensures all unmatched routes return the standard Rocket response envelope
 * {"code": 404, "message": "Route <method>:<url> not found", "data": null}.
 */
export declare function registerNotFoundHandler(app: FastifyInstance): void;
