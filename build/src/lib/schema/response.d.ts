import { ResolvedAppConfig } from '../../interfaces/config.js';
export declare const getResponseStructureSchema: (codes: number[], dataSchema: Record<string, unknown>) => Record<number, object>;
/**
 * Build the security array for the schema based on authentication config.
 */
export declare function buildSecurityArray(config: ResolvedAppConfig, authorization: boolean): Array<{
    [key: string]: string[];
}>;
