/**
 * Try to parse a string as a number; return the original if it fails.
 */
function tryParseNumber(value: string): string | number {
  const trimmed = value.trim();
  if (trimmed === '') return value;
  const n = Number(trimmed);
  return Number.isNaN(n) ? value : n;
}

/**
 * Common signal and pagination keys to ignore when applying filters.
 */
export const filterIgnoreKeys = [
  'page',
  'limit',
  'orderBy',
  'orderDir',
  'q', // For search
];

/**
 * Shared filter application logic for SQL generation.
 * The query param suffixes use the OLD naming convention (_eq, _lt, _lte, _gt, _gte, _in).
 */
export function applyFilters(
  queryParams: Record<string, unknown>,
  startParamIndex: number,
  extraIgnoreKeys: string[] = [],
): {
  whereClauses: string[];
  values: unknown[];
  nextParamIndex: number;
} {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = startParamIndex;

  const allIgnoreKeys = [...filterIgnoreKeys, ...extraIgnoreKeys];

  for (const key of Object.keys(queryParams)) {
    if (allIgnoreKeys.includes(key)) continue;

    if (key.endsWith('_eq')) {
      whereClauses.push(`"${key.replace('_eq', '')}" = $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_lt')) {
      whereClauses.push(`"${key.replace('_lt', '')}" < $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_lte')) {
      whereClauses.push(`"${key.replace('_lte', '')}" <= $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_gt')) {
      whereClauses.push(`"${key.replace('_gt', '')}" > $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_gte')) {
      whereClauses.push(`"${key.replace('_gte', '')}" >= $${paramIndex++}`);
      values.push(queryParams[key]);
    } else if (key.endsWith('_not_in')) {
      const notInValues = String(queryParams[key]).split(',');
      const notInParams = notInValues.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(
        `"${key.replace('_not_in', '')}" NOT IN (${notInParams})`,
      );
      values.push(...notInValues.map(tryParseNumber));
    } else if (key.endsWith('_in')) {
      const inValues = String(queryParams[key]).split(',');
      const inParams = inValues.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`"${key.replace('_in', '')}" IN (${inParams})`);
      values.push(...inValues.map(tryParseNumber));
    } else if (key.endsWith('_ne')) {
      whereClauses.push(`"${key.replace('_ne', '')}" != $${paramIndex++}`);
      values.push(queryParams[key]);
    }
  }

  return {whereClauses, values, nextParamIndex: paramIndex};
}
