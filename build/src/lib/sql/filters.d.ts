/**
 * Common signal and pagination keys to ignore when applying filters.
 */
export declare const filterIgnoreKeys: string[];
/**
 * Shared filter application logic for SQL generation.
 * The query param suffixes use the OLD naming convention (_eq, _lt, _lte, _gt, _gte, _in).
 */
export declare function applyFilters(queryParams: Record<string, unknown>, startParamIndex: number, extraIgnoreKeys?: string[]): {
    whereClauses: string[];
    values: unknown[];
    nextParamIndex: number;
};
