export interface SsoStatePayload {
    /** Random `state` echoed by the identity provider. */
    state: string;
    /** OIDC nonce, validated against the ID token. */
    nonce: string;
    /** PKCE `code_verifier`; never placed in a URL. */
    verifier?: string;
    /** Provider name this flow was started for. */
    provider: string;
    /** Optional landing URL captured at initiation. */
    returnTo?: string;
    /** Milliseconds since epoch. */
    issuedAt: number;
}
/**
 * Derive a purpose-bound key from the application's JWT secret using HKDF, so
 * SSO material never shares a key with bearer-token signing.
 */
export declare function deriveKey(secret: string, info: string): Buffer;
export declare function sealState(secret: string, info: string, payload: SsoStatePayload): string;
export declare function openState(secret: string, info: string, sealed: string): SsoStatePayload;
export declare function safeEqual(left: string, right: string): boolean;
export declare function randomToken(bytes?: number): string;
export declare function generatePkcePair(): {
    verifier: string;
    challenge: string;
};
