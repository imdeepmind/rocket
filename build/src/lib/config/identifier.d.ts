import { CustomEndpointConfig } from '../../interfaces/config.js';
export declare function getAPIFromUniqueIdentifier(config: {
    customEndpoints?: Record<string, CustomEndpointConfig>;
}, identifier: string): CustomEndpointConfig | null;
/**
 * Parse an API identifier and extract its components.
 * Format: <module>.<variant>.<model>.<field>.<operation>
 * Example: "aggregate.v1.users.id.getAggregation"
 * @param identifier The API identifier string to parse
 * @returns Object with module, variant, model, field, operation or null if invalid format
 */
export declare function parseApiIdentifier(identifier: string): {
    module: string;
    variant: string;
    model: string;
    field: string;
    operation: string;
} | null;
/**
 * Build an API identifier string with specific variant.
 * Example: buildApiIdentifier('aggregate', 'admin', 'users', 'id', 'getAggregation')
 * Returns: "aggregate.admin.users.id.getAggregation"
 * @param module The module name (e.g., 'aggregate', 'model', 'auth')
 * @param variant The variant name (e.g., 'v1', 'admin')
 * @param model The model name (e.g., 'users', 'posts')
 * @param field The field name (e.g., 'id', 'email') or 'unknown' or 'all'
 * @param operation The operation name (e.g., 'getAggregation', 'search')
 * @returns The constructed API identifier string
 */
export declare function buildApiIdentifier(module: string, variant: string, model: string, field: string, operation: string): string;
