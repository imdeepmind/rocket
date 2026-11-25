/**
 * Expand a single role pattern (universal `*`, namespaced `prefix:*`, or exact role name).
 *
 * @throws Error if `prefix:*` matches zero declared roles or if exact role is undeclared.
 */
export function expandWildcard(pattern, declaredRoles) {
    if (pattern === '*') {
        return [...declaredRoles];
    }
    if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -2);
        const namespacePrefix = `${prefix}:`;
        const matches = declaredRoles.filter(role => role.startsWith(namespacePrefix));
        if (matches.length === 0) {
            throw new Error(`Wildcard pattern "${pattern}" does not match any declared role in rbac.roles`);
        }
        return matches;
    }
    if (!declaredRoles.includes(pattern)) {
        throw new Error(`Role "${pattern}" does not exist in rbac.roles`);
    }
    return [pattern];
}
/**
 * Expand a list of role patterns into a deduplicated Set of concrete declared roles.
 */
export function expandWildcards(patterns, declaredRoles) {
    const result = new Set();
    for (const pattern of patterns) {
        const matched = expandWildcard(pattern, declaredRoles);
        for (const role of matched) {
            result.add(role);
        }
    }
    return result;
}
/**
 * Precompute the transitive inclusion map (`role -> Set<string>`).
 *
 * Each role's set contains:
 * 1. The role itself (reflexive inclusion).
 * 2. All directly included roles (expanded from exact names, `*`, or `prefix:*`).
 * 3. All transitively included roles (traversed via BFS with cycle detection).
 */
export function buildRoleInclusionMap(roles) {
    const declaredRoles = Object.keys(roles);
    const directInclusions = new Map();
    // Step 1: Precompute direct inclusions for each role
    for (const roleName of declaredRoles) {
        const direct = new Set([roleName]);
        const includes = roles[roleName]?.includes;
        if (includes && includes.length > 0) {
            const expanded = expandWildcards(includes, declaredRoles);
            for (const inc of expanded) {
                direct.add(inc);
            }
        }
        directInclusions.set(roleName, direct);
    }
    // Step 2: Transitive closure with visited tracking
    const transitiveMap = new Map();
    for (const roleName of declaredRoles) {
        const visited = new Set();
        const queue = [roleName];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);
            const targets = directInclusions.get(current);
            for (const target of targets) {
                if (!visited.has(target)) {
                    queue.push(target);
                }
            }
        }
        transitiveMap.set(roleName, visited);
    }
    return transitiveMap;
}
/**
 * Check if a user's role (or any role in user's roles array) satisfies
 * the route's allowed roles set in O(1).
 */
export function isRoleAuthorized(userRoleOrRoles, allowedRoles, roleInclusionMap) {
    if (!allowedRoles || allowedRoles.size === 0) {
        return true;
    }
    if (!userRoleOrRoles) {
        return false;
    }
    const userRoles = Array.isArray(userRoleOrRoles)
        ? userRoleOrRoles
        : [userRoleOrRoles];
    for (const role of userRoles) {
        // Fast path: direct match
        if (allowedRoles.has(role)) {
            return true;
        }
        // Transitive match via precomputed inclusion map
        const included = roleInclusionMap.get(role);
        if (included) {
            for (const inc of included) {
                if (allowedRoles.has(inc)) {
                    return true;
                }
            }
        }
    }
    return false;
}
//# sourceMappingURL=resolution.js.map