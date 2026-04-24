import {FastifyInstance} from 'fastify';

import {registerAggregateRoutes} from '@/routes/aggregate';
import {registerCustomQueryRoutes} from '@/routes/custom-queries';
import {registerDeleteRoutes} from '@/routes/delete';
import {registerEditRoutes} from '@/routes/edit';
import {registerGetAllRoutes} from '@/routes/get-all';
import {registerIndexRoutes} from '@/routes/index-route';
import {registerPostRoutes} from '@/routes/post';
import {registerSearchRoutes} from '@/routes/search';

import {ApisConfig, ModelConfig} from '@/schema/config';

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
export function registerModelRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
  apis?: ApisConfig,
): void {
  registerIndexRoutes(app, models);
  registerSearchRoutes(app, models);
  registerEditRoutes(app, models);
  registerDeleteRoutes(app, models);
  registerAggregateRoutes(app, models);
  registerPostRoutes(app, models);
  registerGetAllRoutes(app, models);

  if (apis) {
    registerCustomQueryRoutes(app, apis);
  }
}
