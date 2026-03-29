import { FastifyInstance } from 'fastify';

import { ModelConfig } from '../schema/config';
import { registerIndexRoutes } from './index-route';
import { registerSearchRoutes } from './search';
import { registerEditRoutes } from './edit';
import { registerDeleteRoutes } from './delete';
import { registerAggregateRoutes } from './aggregate';
import { registerPostRoutes } from './post';
import { registerGetAllRoutes } from './get-all';

/**
 * Register all config-driven model routes on the Fastify instance.
 *
 * Iterates through the provided models and registers routes for each
 * API type based on field capabilities:
 *   - INDEX (primaryKey fields)
 *   - SEARCH (searchable fields)
 *   - EDIT (editable fields)
 *   - DELETE (deletable fields)
 *   - AGGREGATE (fields with supportedAggregation)
 *   - POST (table-level, create record)
 *   - GET_ALL (table-level, list all records)
 */
export function registerModelRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  registerIndexRoutes(app, models);
  registerSearchRoutes(app, models);
  registerEditRoutes(app, models);
  registerDeleteRoutes(app, models);
  registerAggregateRoutes(app, models);
  registerPostRoutes(app, models);
  registerGetAllRoutes(app, models);
}
