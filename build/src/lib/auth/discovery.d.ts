import { AuthCapability, ResolvedAppConfig } from '../../interfaces/config.js';
export interface ProviderLoginDescriptor {
    method: 'GET' | 'POST';
    url: string;
}
export interface ProviderDescriptor {
    type: 'up-auth' | 'api-key' | 'sso';
    name?: string;
    protocol?: string;
    capabilities: AuthCapability[];
    login?: ProviderLoginDescriptor;
}
/**
 * Build the public discovery document. This is the single interface a frontend
 * consumes: it never needs to hardcode provider names or route shapes. The
 * password form and SSO buttons are both rendered from this payload.
 */
export declare function buildProviderDescriptors(config: ResolvedAppConfig, basePath: string): ProviderDescriptor[];
