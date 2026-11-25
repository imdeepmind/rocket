import { DatabaseQuery } from '../../interfaces/database.js';
export type Queryable = Pick<DatabaseQuery, 'query'>;
export interface IdentityLookup {
    model: string;
    providerField: string;
    providerName: string;
    providerIdField: string;
    providerId: string;
    usernameField?: string;
    username?: string;
    attributeMapping?: Record<string, string>;
    claims?: Record<string, unknown>;
}
/**
 * Find-or-create the local account for an external identity.
 *
 * SSO accounts are keyed strictly by `(providerField, providerIdField)`; no
 * email or username is required or inferred. Optional `attributeMapping`
 * claims are persisted only when the developer asked for them.
 */
export declare function resolveUserByIdentity(db: Queryable, lookup: IdentityLookup): Promise<Record<string, unknown>>;
