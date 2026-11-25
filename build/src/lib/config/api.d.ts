import { Aggregation, QueryOperation, ResolvedAppConfig, ServerSideParamConfig, WebhookConfig } from '../../interfaces/config.js';
/**
 * Fully resolved policy for a single generated API endpoint.
 *
 * Scalar fields (`enabled`, `tags`, `authorization`, `bypassSecret`) inherit
 * from the base (default-variant) API override when the variant does not set
 * them. List fields (`webhooks`, `serverSideParams`, `supported*`) never
 * inherit.
 */
export interface ResolvedApiPolicy {
    enabled: boolean;
    tags: string[];
    authorization: boolean;
    bypassSecret: boolean;
    webhooks: WebhookConfig[];
    serverSideParams: ServerSideParamConfig[];
    supportedQueries: QueryOperation[] | undefined;
    supportedAggregations: Aggregation[] | undefined;
    roles?: Set<string>;
}
export interface ApiRouteTarget {
    identifier: string;
    variant: string;
    policy: ResolvedApiPolicy;
}
/**
 * Resolve the effective policy for one API identifier.
 *
 * Rules:
 *   - explicit `enabled` wins; otherwise CRUD APIs of the auth user model are
 *     off; otherwise on
 *   - `authorization` explicit wins, else the global auth flag
 *   - `bypassSecret` explicit or `false`
 *   - `webhooks` / `serverSideParams` configured or `[]`
 *   - `supportedQueries` / `supportedAggregations` stay `undefined` when absent
 *   - scalar fields inherit base → variant
 */
export declare function resolveApiPolicy(config: ResolvedAppConfig, identifier: string): ResolvedApiPolicy;
/**
 * Enumerate the default + configured-variant route targets for an API, in
 * registration order. Targets whose policy resolves to disabled are omitted.
 */
export declare function getApiRouteTargets(config: ResolvedAppConfig, module: string, model: string, field: string, operation: string): ApiRouteTarget[];
