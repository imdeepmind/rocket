import {expect, test} from 'vitest';

import {
  buildUpdatedAtClause,
  getUpdatedAtExpression,
  hasUpdatedAtField,
} from '@/lib/sql/timestamps';

import {ModelConfig} from '@/interfaces/config';

const modelWithUpdatedAt: ModelConfig = {
  fields: {
    id: {type: 'integer', primaryKey: true},
    updated_at: {type: 'datetime'},
  },
};

const modelWithoutUpdatedAt: ModelConfig = {
  fields: {
    id: {type: 'integer', primaryKey: true},
  },
};

test('getUpdatedAtExpression should return now() for postgres', () => {
  expect(getUpdatedAtExpression('postgres')).toBe('now()');
});

test('getUpdatedAtExpression should return sqlite datetime expression for sqlite', () => {
  expect(getUpdatedAtExpression('sqlite')).toBe("(datetime('now'))");
});

test('hasUpdatedAtField should return true when model has updated_at', () => {
  expect(hasUpdatedAtField(modelWithUpdatedAt)).toBe(true);
});

test('hasUpdatedAtField should return false when model lacks updated_at', () => {
  expect(hasUpdatedAtField(modelWithoutUpdatedAt)).toBe(false);
});

test('buildUpdatedAtClause should return null when model lacks updated_at', () => {
  expect(buildUpdatedAtClause(modelWithoutUpdatedAt, 'postgres')).toBeNull();
});

test('buildUpdatedAtClause should build postgres clause', () => {
  expect(buildUpdatedAtClause(modelWithUpdatedAt, 'postgres')).toBe(
    '"updated_at" = now()',
  );
});

test('buildUpdatedAtClause should build sqlite clause', () => {
  expect(buildUpdatedAtClause(modelWithUpdatedAt, 'sqlite')).toBe(
    '"updated_at" = (datetime(\'now\'))',
  );
});
