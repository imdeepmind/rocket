import { buildApiIdentifier, parseApiIdentifier } from '../../lib/config/identifier.js';
import { deriveApiTags } from '../../lib/config/tags.js';
import { expandWildcards } from '../../lib/rbac/index.js';
function getAuthModel(config) {
    const { authentication } = config;
    if (!authentication.enabled) {
        return null;
    }
    const hasIdentityProvider = authentication.providers.some(provider => provider.type !== 'api-key');
    return hasIdentityProvider
        ? (authentication.userModel?.modelName ?? null)
        : null;
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
export function resolveApiPolicy(config, identifier) {
    const parsed = parseApiIdentifier(identifier);
    const defaultVariant = config.application.dangerouslyOverrideDefaultVariant;
    const baseIdentifier = parsed
        ? buildApiIdentifier(parsed.module, defaultVariant, parsed.model, parsed.field, parsed.operation)
        : identifier;
    const override = config.apis[identifier];
    const baseOverride = config.apis[baseIdentifier];
    const authModelDefaultOff = parsed?.module === 'model' && parsed.model === getAuthModel(config);
    const enabled = override?.enabled ?? baseOverride?.enabled ?? !authModelDefaultOff;
    const rawRoles = override?.roles ?? baseOverride?.roles;
    let roles;
    if (rawRoles && config.rbac?.enabled && config.rbac.roles) {
        const declaredRoles = Object.keys(config.rbac.roles);
        roles = expandWildcards(rawRoles, declaredRoles);
    }
    return {
        enabled,
        tags: override?.tags ?? baseOverride?.tags ?? deriveApiTags(identifier),
        authorization: override?.authorization ??
            baseOverride?.authorization ??
            config.authentication.enabled,
        bypassSecret: override?.bypassSecret ?? baseOverride?.bypassSecret ?? false,
        webhooks: override?.webhooks ?? [],
        serverSideParams: override?.serverSideParams ?? [],
        supportedQueries: override?.supportedQueries,
        supportedAggregations: override?.supportedAggregations,
        ...(roles !== undefined ? { roles } : {}),
    };
}
/**
 * Enumerate the default + configured-variant route targets for an API, in
 * registration order. Targets whose policy resolves to disabled are omitted.
 */
export function getApiRouteTargets(config, module, model, field, operation) {
    const defaultVariant = config.application.dangerouslyOverrideDefaultVariant;
    const defaultIdentifier = buildApiIdentifier(module, defaultVariant, model, field, operation);
    const variants = [
        defaultVariant,
        ...(config.apiVariants[defaultIdentifier]?.variants ?? []),
    ];
    const targets = [];
    for (const variant of new Set(variants)) {
        const identifier = buildApiIdentifier(module, variant, model, field, operation);
        const policy = resolveApiPolicy(config, identifier);
        if (policy.enabled) {
            targets.push({ identifier, variant, policy });
        }
    }
    return targets;
}
//# sourceMappingURL=api.js.map