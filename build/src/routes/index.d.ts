import { FastifyInstance } from 'fastify';
import { ResolvedAppConfig } from '../interfaces/config.js';
/**
 * Register all config-driven model routes on the Fastify instance.
 *
 * Iterates through the provided models and registers routes for each
 * API type based on field capabilities:
 *   - INDEX (primaryKey fields)
 *   - SEARCH (searchable fields)
 *   - EDIT (editable fields)
 *   - DELETE (deletable fields)
 *   - POST (table-level, create record)
 *   - GET_ALL (table-level, list all records)
 *
 *   - AGGREGATE (fields with supportedAggregation)
 *
 *   - CUSTOM_ENDPOINTS (custom endpoints)
 */
export declare function registerRoutes(app: FastifyInstance, config: ResolvedAppConfig): void;
export { registerHealthRoute } from '../routes/health.js';
