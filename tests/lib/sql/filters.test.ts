import {expect, test} from 'vitest';

import {applyFilters} from '@/lib/sql/filters';

// test cases for applyFilters
test('applyFilters should skip keys that do not match any suffix', () => {
  const result = applyFilters({unknown_field: 'val'}, 1);
  expect(result.whereClauses).toEqual([]);
  expect(result.values).toEqual([]);
  expect(result.nextParamIndex).toBe(1);
});

test('applyFilters should skip ignore keys', () => {
  const result = applyFilters({page: '1', limit: '20', q: 'search'}, 1);
  expect(result.whereClauses).toEqual([]);
  expect(result.values).toEqual([]);
  expect(result.nextParamIndex).toBe(1);
});

test('applyFilters should use extraIgnoreKeys', () => {
  const result = applyFilters({name_eq: 'foo', extra_ignore: 'bar'}, 1, [
    'extra_ignore',
  ]);
  expect(result.whereClauses).toEqual(['"name" = $1']);
  expect(result.values).toEqual(['foo']);
  expect(result.nextParamIndex).toBe(2);
});

test('applyFilters should handle _in with empty string values', () => {
  const result = applyFilters({age_in: '1,,3'}, 1);
  expect(result.whereClauses).toEqual(['"age" IN ($1, $2, $3)']);
  expect(result.values).toEqual([1, '', 3]);
  expect(result.nextParamIndex).toBe(4);
});

test('applyFilters should handle _in with non-numeric values', () => {
  const result = applyFilters({age_in: 'abc,def'}, 1);
  expect(result.whereClauses).toEqual(['"age" IN ($1, $2)']);
  expect(result.values).toEqual(['abc', 'def']);
  expect(result.nextParamIndex).toBe(3);
});

test('applyFilters should handle all filter suffixes', () => {
  const result = applyFilters(
    {
      age_eq: '25',
      age_ne: '99',
      age_lt: '30',
      age_lte: '30',
      age_gt: '20',
      age_gte: '20',
      age_in: '1,2,3',
      age_not_in: '10,20,30',
    },
    1,
  );
  expect(result.whereClauses).toEqual([
    '"age" = $1',
    '"age" != $2',
    '"age" < $3',
    '"age" <= $4',
    '"age" > $5',
    '"age" >= $6',
    '"age" IN ($7, $8, $9)',
    '"age" NOT IN ($10, $11, $12)',
  ]);
  expect(result.values).toEqual([
    '25',
    '99',
    '30',
    '30',
    '20',
    '20',
    1,
    2,
    3,
    10,
    20,
    30,
  ]);
  expect(result.nextParamIndex).toBe(13);
});
