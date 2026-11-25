import { RoleConfig } from '../../interfaces/config.js';
/**
 * Expand a single role pattern (universal `*`, namespaced `prefix:*`, or exact role name).
 *
 * @throws Error if `prefix:*` matches zero declared roles or if exact role is undeclared.
 */
export declare function expandWildcard(pattern: string, declaredRoles: string[]): string[];
/**
 * Expand a list of role patterns into a deduplicated Set of concrete declared roles.
 */
export declare function expandWildcards(patterns: string[], declaredRoles: string[]): Set<string>;
/**
 * Precompute the transitive inclusion map (`role -> Set<string>`).
 *
 * Each role's set contains:
 * 1. The role itself (reflexive inclusion).
 * 2. All directly included roles (expanded from exact names, `*`, or `prefix:*`).
 * 3. All transitively included roles (traversed via BFS with cycle detection).
 */
export declare function buildRoleInclusionMap(roles: Record<string, RoleConfig>): Map<string, Set<string>>;
/**
 * Check if a user's role (or any role in user's roles array) satisfies
 * the route's allowed roles set in O(1).
 */
export declare function isRoleAuthorized(userRoleOrRoles: string | string[] | undefined | null, allowedRoles: Set<string> | undefined, roleInclusionMap: Map<string, Set<string>>): boolean;
