import { AuthCapability } from '../../interfaces/config.js';
/**
 * The single value both authentication flows converge on. Password logins and
 * every SSO protocol produce one of these; everything downstream (user
 * resolution, JWT issuance) is protocol agnostic.
 */
export interface ExternalIdentity {
    /** Provider name, i.e. the value persisted in `<providerField>`. */
    provider: string;
    /** Stable external subject: username for up-auth, `sub`/`NameID` for SSO. */
    providerId: string;
    /** Optional IdP claims, used by `attributeMapping`. */
    claims?: Record<string, unknown>;
}
export type AuthProviderType = 'up-auth' | 'api-key' | 'sso';
export interface AuthCapabilitySet {
    readonly capabilities: ReadonlySet<AuthCapability>;
}
export { AuthCapability };
