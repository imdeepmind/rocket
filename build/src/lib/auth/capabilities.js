/**
 * Provider identity and capabilities are derived, never configured. Keeping
 * them out of the resolved object means a resolved config is still a valid
 * config, which `resolveAndValidateConfig` relies on.
 */
export function getProviderName(provider) {
    return provider.type === 'sso' ? provider.name : provider.type;
}
export function getProviderCapabilities(provider) {
    if (provider.type === 'up-auth') {
        const capabilities = ['password', 'register'];
        if (provider.config.mfaRequired) {
            capabilities.push('mfa');
        }
        return capabilities;
    }
    if (provider.type === 'api-key') {
        return [];
    }
    const capabilities = ['initiate', 'callback'];
    if (provider.protocol === 'saml') {
        capabilities.push('metadata');
    }
    if (provider.config.redirectUrl) {
        capabilities.push('token-exchange');
    }
    return capabilities;
}
//# sourceMappingURL=capabilities.js.map