import {getProviderCapabilities} from '@/lib/auth/capabilities';

import {AuthCapability, ResolvedAppConfig} from '@/interfaces/config';

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
export function buildProviderDescriptors(
  config: ResolvedAppConfig,
  basePath: string,
): ProviderDescriptor[] {
  const {authentication} = config;

  if (!authentication.enabled) {
    return [];
  }

  return authentication.providers.map(provider => {
    const capabilities = getProviderCapabilities(provider);

    if (provider.type === 'up-auth') {
      return {
        type: 'up-auth' as const,
        capabilities,
        login: {method: 'POST' as const, url: `${basePath}/auth/login`},
      };
    }

    if (provider.type === 'api-key') {
      return {type: 'api-key' as const, capabilities};
    }

    return {
      type: 'sso' as const,
      name: provider.name,
      protocol: provider.protocol,
      capabilities,
      login: {
        method: 'GET' as const,
        url: `${basePath}/auth/sso/${provider.name}/login`,
      },
    };
  });
}
