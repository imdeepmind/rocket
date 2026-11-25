import { RbacConfig } from '../../interfaces/config.js';
export interface JwtRolePayload {
    role?: string;
    roles?: string[];
}
/**
 * Extract role / roles from user record according to RBAC configuration.
 *
 * If RBAC is disabled or absent, returns an empty object.
 * If user has a string role: returns `{ role: string }`.
 * If user has an array of roles: returns `{ roles: string[] }`.
 * If user has a JSON-encoded array of roles: returns `{ roles: string[] }`.
 * If user has no role / null / undefined / empty: falls back to `rbac.defaultRole`,
 * returning `{ role: defaultRole }`.
 */
export declare function extractJwtRolePayload(user: Record<string, unknown> | undefined, rbac: RbacConfig | undefined): JwtRolePayload;
