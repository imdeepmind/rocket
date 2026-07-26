import {FastifyInstance} from 'fastify';

import {registerAggregateRoutes} from '@/routes/aggregate/aggregate';
import {registerCustomEndpointRoutes} from '@/routes/custom-endpoints/custom-endpoints';
import {registerDeleteRoutes} from '@/routes/models/delete';
import {registerEditRoutes} from '@/routes/models/edit';
import {registerGetAllRoutes} from '@/routes/models/get-all';
import {registerIndexRoutes} from '@/routes/models/index-route';
import {registerPostRoutes} from '@/routes/models/post';
import {registerSearchRoutes} from '@/routes/models/search';

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
 *   - CUSTOM_ENDPOINTS (custom endpoints)
 */
export function registerRoutes(app: FastifyInstance, config: AppConfig): void {
  // models
  registerIndexRoutes(app, config);
  registerSearchRoutes(app, config);
  registerEditRoutes(app, config);
  registerDeleteRoutes(app, config);
  registerPostRoutes(app, config);
  registerGetAllRoutes(app, config);

  // aggregations
  registerAggregateRoutes(app, config);

  // custom endpoints
  registerCustomEndpointRoutes(app, config);
}
