/**
 * Append parameters to a developer-configured redirect target.
 *
 * The target is always config-owned, never client-supplied, which is what makes
 * an allow-list unnecessary: there is no attacker-controlled input to smuggle
 * into the location header.
 */
export declare function buildRedirectUrl(target: string, params: Record<string, string | undefined>): string;
