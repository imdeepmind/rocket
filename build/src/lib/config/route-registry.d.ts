import { AppConfig, ResolvedAppConfig } from '../../interfaces/config.js';
/**
 * Enumerate every API identifier that the route registration layer can
 * generate for a resolved configuration.
 *
 * This is deliberately structural: identifiers are included even when the
 * resolved policy disables them (`apis.<id>.enabled === false`), because an
 * `apis` override may legitimately reference and re-enable a gated route.
 * Variant identifiers are derived from `apiVariants` entries keyed by the
 * default-variant identifier.
 */
export declare function getGeneratedApiIdentifiers(config: AppConfig | ResolvedAppConfig): Set<string>;
/**
 * Whether an `apis` override key refers to a route the router can generate.
 */
export declare function isGeneratedApiIdentifier(config: AppConfig | ResolvedAppConfig, identifier: string): boolean;
