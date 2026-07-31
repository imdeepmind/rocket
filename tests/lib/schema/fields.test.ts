import {expect, test} from 'vitest';

import {
  filterManagedTimestampFields,
  isManagedTimestampField,
  MANAGED_TIMESTAMP_FIELDS,
} from '@/lib/schema/fields';

import {ModelFieldConfig} from '@/interfaces/config';

test('MANAGED_TIMESTAMP_FIELDS should contain created_at and updated_at', () => {
  expect(MANAGED_TIMESTAMP_FIELDS).toEqual(['created_at', 'updated_at']);
});

test('isManagedTimestampField should return true for created_at and updated_at', () => {
  expect(isManagedTimestampField('created_at')).toBe(true);
  expect(isManagedTimestampField('updated_at')).toBe(true);
});

test('isManagedTimestampField should return false for other fields', () => {
  expect(isManagedTimestampField('id')).toBe(false);
  expect(isManagedTimestampField('name')).toBe(false);
});

test('filterManagedTimestampFields should remove managed fields', () => {
  const fields: Array<[string, ModelFieldConfig]> = [
    ['id', {type: 'integer'}],
    ['name', {type: 'string'}],
    ['created_at', {type: 'datetime'}],
    ['updated_at', {type: 'datetime'}],
  ];

  const result = filterManagedTimestampFields(fields);

  expect(result.map(([name]) => name)).toEqual(['id', 'name']);
});
