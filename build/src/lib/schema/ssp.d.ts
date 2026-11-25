import { ServerSideParamConfig } from '../../interfaces/config.js';
/**
 * Strip server-side params from a route schema for Swagger visibility.
 *
 * Removes query properties that match a SSP name (including filter
 * variants like `field_eq`, `field_lt` etc.) and body properties that
 * match a SSP name. **Path params are never removed** so the URL
 * structure stays visible in the docs.
 */
export declare function stripServerSideParamsFromSchema(schema: Record<string, unknown>, serverSideParams: ServerSideParamConfig[]): void;
