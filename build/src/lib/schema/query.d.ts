import { ModelConfig, ModelFieldConfig, QueryOperation } from '../../interfaces/config.js';
/**
 * Standard pagination query parameter schema properties.
 */
export declare const paginationQueryProperties: Record<string, object>;
/**
 * Build sort query parameter schema properties for sortable fields.
 */
export declare function buildSortQueryProperties(sortableFields: string[]): Record<string, object>;
/**
 * Build all query parameter schema properties for a model:
 * filter params, sort params, and pagination params.
 */
export declare function buildAllQueryProperties(model: ModelConfig, effectiveQueries?: QueryOperation[], bypassSecret?: boolean): Record<string, object>;
/**
 * Build filter query parameter schema properties for a field
 * based on its query operations (lt, lte, gt, gte, eq, in, etc.).
 */
export declare function buildFilterQueryProperties(fieldName: string, field: ModelFieldConfig, effectiveQueries?: QueryOperation[]): Record<string, object>;
