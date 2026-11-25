import { AuthUserModelConfig, ResolvedAppConfig, ResolvedSsoProvider, ResolvedUpAuthProvider } from '../../interfaces/config.js';
export interface UpAuthRuntime {
    provider: ResolvedUpAuthProvider;
    model: string;
    idField: string;
    providerField: string;
    usernameField: string;
    passwordField: string;
    isVerifiedField?: string;
    mfaRequired: boolean;
}
/**
 * Project the resolved up-auth provider into the shape the password routes
 * need. Returns `null` when no up-auth provider is configured, which is the
 * capability check every password route performs.
 */
export declare function getUpAuth(config: ResolvedAppConfig): UpAuthRuntime | null;
export declare function getSsoProviders(config: ResolvedAppConfig): ResolvedSsoProvider[];
export declare function getAuthModel(config: ResolvedAppConfig): string | null;
/**
 * The shared user-table columns, or `null` when only a static `api-key`
 * provider is configured (which has no identity table).
 */
export declare function getActiveUserModel(config: ResolvedAppConfig): AuthUserModelConfig | null;
