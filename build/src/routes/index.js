import { registerAggregateRoutes } from '../routes/aggregate/aggregate.js';
import { registerCustomEndpointRoutes } from '../routes/custom-endpoints/custom-endpoints.js';
import { registerDeleteRoutes } from '../routes/models/delete.js';
import { registerEditRoutes } from '../routes/models/edit.js';
import { registerGetAllRoutes } from '../routes/models/get-all.js';
import { registerIndexRoutes } from '../routes/models/index-route.js';
import { registerPostRoutes } from '../routes/models/post.js';
import { registerSearchRoutes } from '../routes/models/search.js';
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
export function registerRoutes(app, config) {
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
export { registerHealthRoute } from '../routes/health.js';
//# sourceMappingURL=index.js.map