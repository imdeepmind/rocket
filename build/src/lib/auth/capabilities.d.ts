import { AuthCapability, ResolvedAuthProvider } from '../../interfaces/config.js';
/**
 * Provider identity and capabilities are derived, never configured. Keeping
 * them out of the resolved object means a resolved config is still a valid
 * config, which `resolveAndValidateConfig` relies on.
 */
export declare function getProviderName(provider: ResolvedAuthProvider): string;
export declare function getProviderCapabilities(provider: ResolvedAuthProvider): AuthCapability[];
