import {RbacConfig} from '@/interfaces/config';

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
export function extractJwtRolePayload(
  user: Record<string, unknown> | undefined,
  rbac: RbacConfig | undefined,
): JwtRolePayload {
  if (!rbac?.enabled) {
    return {};
  }

  const roleField = rbac.roleField;
  let rawValue = roleField && user ? user[roleField] : undefined;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    rawValue = rbac.defaultRole;
  }

  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0 && rbac.defaultRole) {
      return {role: rbac.defaultRole};
    }
    return {roles: rawValue.map(String)};
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0 && rbac.defaultRole) {
            return {role: rbac.defaultRole};
          }
          return {roles: parsed.map(String)};
        }
      } catch {
        // Not valid JSON, treat as plain role string
      }
    }

    if (trimmed.length > 0) {
      return {role: trimmed};
    }
  }

  if (rbac.defaultRole) {
    return {role: rbac.defaultRole};
  }

  return {};
}
