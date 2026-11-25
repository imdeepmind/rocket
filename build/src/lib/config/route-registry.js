import { buildApiIdentifier } from '../../lib/config/identifier.js';
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
export function getGeneratedApiIdentifiers(config) {
    const identifiers = new Set();
    // Compatibility: `validateConfig` also accepts sparse input shapes, where
    // the variant may not have been resolved yet.
    const defaultVariant = config.application.dangerouslyOverrideDefaultVariant ?? 'v1';
    const addTargets = (module, model, field, operation) => {
        const defaultIdentifier = buildApiIdentifier(module, defaultVariant, model, field, operation);
        const variants = [
            defaultVariant,
            ...(config.apiVariants?.[defaultIdentifier]?.variants ?? []),
        ];
        for (const variant of new Set(variants)) {
            identifiers.add(buildApiIdentifier(module, variant, model, field, operation));
        }
    };
    for (const [modelName, model] of Object.entries(config.data.models)) {
        addTargets('model', modelName, 'unknown', 'insert');
        addTargets('model', modelName, 'unknown', 'getAll');
        for (const [fieldName, field] of Object.entries(model.fields)) {
            const fieldApis = field.apis ?? [];
            if (field.primaryKey || field.unique || fieldApis.includes('index')) {
                addTargets('model', modelName, fieldName, 'index');
            }
            if (fieldApis.includes('search')) {
                addTargets('model', modelName, fieldName, 'search');
            }
            if (fieldApis.includes('edit')) {
                addTargets('model', modelName, fieldName, 'edit');
            }
            if (fieldApis.includes('delete')) {
                addTargets('model', modelName, fieldName, 'delete');
            }
            if ((field.aggregations ?? []).length > 0) {
                addTargets('aggregate', modelName, fieldName, 'getAggregation');
            }
        }
    }
    for (const name of Object.keys(config.customEndpoints ?? {})) {
        addTargets('custom', 'all', 'unknown', name);
    }
    const authentication = config.authentication;
    if (authentication?.enabled) {
        const providers = authentication.providers ?? [];
        const upAuth = providers.find(provider => provider.type === 'up-auth');
        const ssoProviders = providers.filter(provider => provider.type === 'sso');
        const authModel = authentication.userModel?.modelName;
        if (authModel) {
            const sharedOperations = ['providers', 'me', 'deleteMe', 'editMe'];
            for (const operation of sharedOperations) {
                addTargets('auth', authModel, 'unknown', operation);
            }
        }
        if (authModel && upAuth) {
            const upConfig = upAuth.config;
            const operations = ['registration', 'login', 'changePassword'];
            if (config.integrations?.email) {
                operations.push('forgotPassword', 'otpVerifyForgotPassword', 'resendOtpForgotPassword');
            }
            if (upConfig.mfaRequired) {
                operations.push('otpVerifyLogin', 'resendOtpLogin');
            }
            if (upConfig.fields?.isVerifiedField) {
                operations.push('otpVerifyRegister', 'resendOtpRegister', 'emailChange');
            }
            for (const operation of operations) {
                addTargets('auth', authModel, 'unknown', operation);
            }
        }
        if (authModel && ssoProviders.length > 0) {
            const operations = ['ssoLogin', 'ssoCallback'];
            if (ssoProviders.some(provider => provider.protocol === 'saml')) {
                operations.push('ssoMetadata');
            }
            if (ssoProviders.some(provider => provider.config.redirectUrl)) {
                operations.push('ssoToken');
            }
            for (const operation of operations) {
                addTargets('auth', authModel, 'unknown', operation);
            }
        }
    }
    return identifiers;
}
/**
 * Whether an `apis` override key refers to a route the router can generate.
 */
export function isGeneratedApiIdentifier(config, identifier) {
    return getGeneratedApiIdentifiers(config).has(identifier);
}
//# sourceMappingURL=route-registry.js.map