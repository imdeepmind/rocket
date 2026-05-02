import {FastifyInstance} from 'fastify';

import {registerAggregateRoutes} from '@/routes/aggregate/aggregate';
import {registerCustomQueryRoutes} from '@/routes/custom-queries/custom-queries';
import {registerDeleteRoutes} from '@/routes/operations/delete';
import {registerEditRoutes} from '@/routes/operations/edit';
import {registerGetAllRoutes} from '@/routes/operations/get-all';
import {registerIndexRoutes} from '@/routes/operations/index-route';
import {registerPostRoutes} from '@/routes/operations/post';
import {registerSearchRoutes} from '@/routes/operations/search';

import {ApisConfig, CustomAPIConfig, ModelConfig} from '@/schema/config';

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
export function registerRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
  apis?: ApisConfig,
  customApis?: CustomAPIConfig,
): void {
  // operations
  registerIndexRoutes(app, models, apis);
  registerSearchRoutes(app, models, apis);
  registerEditRoutes(app, models, apis);
  registerDeleteRoutes(app, models, apis);
  registerPostRoutes(app, models, apis);
  registerGetAllRoutes(app, models, apis);

  // aggregations
  registerAggregateRoutes(app, models, apis);

  // custom queries
  registerCustomQueryRoutes(app, customApis);
}
