import { getProviderCapabilities } from '../../lib/auth/capabilities.js';
/**
 * Build the public discovery document. This is the single interface a frontend
 * consumes: it never needs to hardcode provider names or route shapes. The
 * password form and SSO buttons are both rendered from this payload.
 */
export function buildProviderDescriptors(config, basePath) {
    const { authentication } = config;
    if (!authentication.enabled) {
        return [];
    }
    return authentication.providers.map(provider => {
        const capabilities = getProviderCapabilities(provider);
        if (provider.type === 'up-auth') {
            return {
                type: 'up-auth',
                capabilities,
                login: { method: 'POST', url: `${basePath}/auth/login` },
            };
        }
        if (provider.type === 'api-key') {
            return { type: 'api-key', capabilities };
        }
        return {
            type: 'sso',
            name: provider.name,
            protocol: provider.protocol,
            capabilities,
            login: {
                method: 'GET',
                url: `${basePath}/auth/sso/${provider.name}/login`,
            },
        };
    });
}
//# sourceMappingURL=discovery.js.map