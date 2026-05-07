import {FastifyInstance} from 'fastify';

import {registerAggregateRoutes} from '@/routes/aggregate/aggregate';
import {registerCustomQueryRoutes} from '@/routes/custom-queries/custom-queries';
import {registerDeleteRoutes} from '@/routes/operations/delete';
import {registerEditRoutes} from '@/routes/operations/edit';
import {registerGetAllRoutes} from '@/routes/operations/get-all';
import {registerIndexRoutes} from '@/routes/operations/index-route';
import {registerPostRoutes} from '@/routes/operations/post';
import {registerSearchRoutes} from '@/routes/operations/search';

import {AppConfig} from '@/interfaces/config';

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
 *   - CUSTOM_QUERIES (custom queries)
 */
export function registerRoutes(app: FastifyInstance, config: AppConfig): void {
  // operations
  registerIndexRoutes(app, config);
  registerSearchRoutes(app, config);
  registerEditRoutes(app, config);
  registerDeleteRoutes(app, config);
  registerPostRoutes(app, config);
  registerGetAllRoutes(app, config);

  // aggregations
  registerAggregateRoutes(app, config);

  // custom queries
  registerCustomQueryRoutes(app, config);
}
