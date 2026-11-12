import {expect, it} from 'vitest';

import {mapDataTypeToJsonSchema} from '@/lib/schema/types';

import {DataType} from '@/interfaces/config';

// test cases for mapDataTypeToJsonSchema
it.each([
  {dataType: 'string', expectedSchema: {type: 'string'}},
  {dataType: 'integer', expectedSchema: {type: 'integer'}},
  {dataType: 'boolean', expectedSchema: {type: 'boolean'}},
  {dataType: 'text', expectedSchema: {type: 'string'}},
  {
    dataType: 'datetime',
    expectedSchema: {type: 'string', format: 'date-time'},
  },
  {dataType: 'decimal', expectedSchema: {type: 'number'}},
  {dataType: 'date', expectedSchema: {type: 'string', format: 'date'}},
  {dataType: 'json', expectedSchema: {type: 'object'}},
  {dataType: 'enum', expectedSchema: {type: 'string'}},
  {dataType: 'uuid', expectedSchema: {type: 'string'}},
  {dataType: 'ulid', expectedSchema: {type: 'string'}},
  {dataType: 'array', expectedSchema: {type: 'string'}},
  {dataType: 'null', expectedSchema: {type: 'string'}},
])('should map $dataType to JSON schema', ({dataType, expectedSchema}) => {
  expect(mapDataTypeToJsonSchema(dataType as DataType)).toEqual(expectedSchema);
});
