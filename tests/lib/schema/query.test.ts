import {expect, test} from 'vitest';

import {
  buildAllQueryProperties,
  buildFilterQueryProperties,
  buildSortQueryProperties,
} from '@/lib/schema/query';

import {ModelConfig, ModelFieldConfig} from '@/interfaces/config';

// test cases for buildAllQueryProperties with effectiveQueries
test('buildAllQueryProperties should respect effectiveQueries to limit query operations', () => {
  const model: ModelConfig = {
    fields: {
      id: {type: 'integer', primaryKey: true},
      name: {type: 'string', query: ['eq', 'ne', 'sort']},
      age: {type: 'integer', query: ['lt', 'gt', 'eq']},
    },
  };
  const result = buildAllQueryProperties(model, ['eq', 'lt', 'gt']);
  // name should only have eq (ne filtered out)
  expect(result).toHaveProperty('name_eq');
  expect(result).not.toHaveProperty('name_ne');
  // age should only have lt, gt, eq
  expect(result).toHaveProperty('age_lt');
  expect(result).toHaveProperty('age_gt');
  expect(result).toHaveProperty('age_eq');
  // sort should be excluded since 'sort' is not in effectiveQueries
  expect(result).not.toHaveProperty('orderBy');
  expect(result).not.toHaveProperty('orderDir');
  // pagination should always be present
  expect(result).toHaveProperty('page');
  expect(result).toHaveProperty('limit');
});

test('buildAllQueryProperties should include all when effectiveQueries is undefined', () => {
  const model: ModelConfig = {
    fields: {
      name: {type: 'string', query: ['eq', 'ne', 'sort']},
      age: {type: 'integer', query: ['lt', 'gt', 'eq']},
    },
  };
  const result = buildAllQueryProperties(model);
  expect(result).toHaveProperty('name_eq');
  expect(result).toHaveProperty('name_ne');
  expect(result).toHaveProperty('age_lt');
  expect(result).toHaveProperty('age_gt');
  expect(result).toHaveProperty('age_eq');
  expect(result).toHaveProperty('orderBy');
  expect(result).toHaveProperty('orderDir');
});

// test cases for buildFilterQueryProperties with effectiveQueries
test('buildFilterQueryProperties should intersect field query with effectiveQueries', () => {
  const field: ModelFieldConfig = {
    type: 'integer',
    query: ['eq', 'lt', 'gt', 'sort'],
  };
  const result = buildFilterQueryProperties('age', field, ['eq', 'lt']);
  expect(result).toHaveProperty('age_lt');
  expect(result).toHaveProperty('age_eq');
  expect(result).not.toHaveProperty('age_gt');
});

// test cases for buildSortQueryProperties
test('should build sort query properties', () => {
  const sortableFields = ['id', 'name', 'age'];
  const expectedSchema = {
    orderBy: {
      type: 'string',
      enum: sortableFields,
      description: `Column to sort by. Allowed: ${sortableFields.join(', ')}`,
    },
    orderDir: {
      type: 'string',
      enum: ['asc', 'desc'],
      description: 'Sort direction',
      default: 'asc',
    },
  };
  expect(buildSortQueryProperties(sortableFields)).toEqual(expectedSchema);
});

// test cases for buildFilterQueryProperties
test('should build filter query properties', () => {
  const field: ModelFieldConfig = {
    type: 'integer',
    query: ['lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'in', 'not_in'],
  };
  const expectedSchema = {
    age_lt: {
      type: 'integer',
      description: 'Filter where age is less than this value',
    },
    age_lte: {
      type: 'integer',
      description: 'Filter where age is less than or equal to this value',
    },
    age_gt: {
      type: 'integer',
      description: 'Filter where age is greater than this value',
    },
    age_gte: {
      type: 'integer',
      description: 'Filter where age is greater than or equal to this value',
    },
    age_eq: {
      type: 'integer',
      description: 'Filter where age equals this value',
    },
    age_ne: {
      type: 'integer',
      description: 'Filter where age does not equal this value',
    },
    age_in: {
      type: 'string',
      description:
        'Filter where age is one of the provided comma-separated values',
    },
    age_not_in: {
      type: 'string',
      description:
        'Filter where age is not one of the provided comma-separated values',
    },
  };
  expect(buildFilterQueryProperties('age', field)).toEqual(expectedSchema);
});
