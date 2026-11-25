import { buildRoleInclusionMap, expandWildcards, isRoleAuthorized, } from '../../lib/rbac/index.js';
const inclusionMapCache = new WeakMap();
function getRoleInclusionMap(rbac) {
    if (!rbac?.enabled || !rbac.roles) {
        return new Map();
    }
    let map = inclusionMapCache.get(rbac);
    if (!map) {
        map = buildRoleInclusionMap(rbac.roles);
        inclusionMapCache.set(rbac, map);
    }
    return map;
}
/**
 * Build a preValidation handler that runs the specified checks.
 *
 *   - 'auth': authenticate the request if auth is enabled + authorization flag is set,
 *             and enforce RBAC role permissions if RBAC is enabled.
 */
export function buildPreValidation(app, config, authorization, roles, checks = ['auth']) {
    let allowedRolesSet;
    if (roles instanceof Set) {
        allowedRolesSet = roles;
    }
    else if (Array.isArray(roles)) {
        if (config.rbac?.enabled && config.rbac.roles) {
            const declared = Object.keys(config.rbac.roles);
            allowedRolesSet = expandWildcards(roles, declared);
        }
        else {
            allowedRolesSet = new Set(roles);
        }
    }
    return async (request, reply) => {
        if (checks.includes('auth') &&
            config.authentication.enabled &&
            authorization) {
            try {
                await request.authenticate();
            }
            catch {
                return reply
                    .status(401)
                    .send(app.buildResponse(401, 'Invalid or expired authentication token', null));
            }
            if (config.rbac?.enabled) {
                if (!allowedRolesSet || allowedRolesSet.size === 0) {
                    (request.log ?? app.log).warn('Route has authorization enabled but no roles configured');
                    return;
                }
                const user = request.user;
                const userRoles = [];
                if (user?.role) {
                    userRoles.push(user.role);
                }
                if (Array.isArray(user?.roles)) {
                    for (const r of user.roles) {
                        if (r && !userRoles.includes(r)) {
                            userRoles.push(r);
                        }
                    }
                }
                const roleInclusionMap = getRoleInclusionMap(config.rbac);
                const authorized = isRoleAuthorized(userRoles.length > 0 ? userRoles : undefined, allowedRolesSet, roleInclusionMap);
                if (!authorized) {
                    return reply
                        .status(403)
                        .send(app.buildResponse(403, 'Forbidden: Insufficient permissions', null));
                }
            }
        }
    };
}
//# sourceMappingURL=prevalidation.js.map