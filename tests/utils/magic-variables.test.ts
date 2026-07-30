import {describe, expect, it} from 'vitest';

import {parseMagicVariables} from '@/utils/magic-variables';

describe('parseMagicVariables', () => {
  it('should parse a single path magic variable', () => {
    const result = parseMagicVariables(
      'SELECT * FROM users WHERE id = $$id:integer$$',
    );
    expect(result).toEqual([{delimiter: '$$', name: 'id', type: 'integer'}]);
  });

  it('should parse a single query magic variable', () => {
    const result = parseMagicVariables(
      'SELECT * FROM users WHERE name = &&name:string&&',
    );
    expect(result).toEqual([{delimiter: '&&', name: 'name', type: 'string'}]);
  });

  it('should parse a single body magic variable', () => {
    const result = parseMagicVariables(
      'INSERT INTO users (name) VALUES (@@name:string@@)',
    );
    expect(result).toEqual([{delimiter: '@@', name: 'name', type: 'string'}]);
  });

  it('should parse multiple magic variables of different types', () => {
    const sql =
      'SELECT * FROM users WHERE id = $$id:integer$$ AND name = &&name:string&&';
    const result = parseMagicVariables(sql);
    expect(result).toEqual([
      {delimiter: '$$', name: 'id', type: 'integer'},
      {delimiter: '&&', name: 'name', type: 'string'},
    ]);
  });

  it('should parse magic variables with hyphens and underscores in names', () => {
    const result = parseMagicVariables(
      'SELECT * FROM $$user-id:integer$$ WHERE &&my_field:string&& = ?',
    );
    expect(result).toEqual([
      {delimiter: '$$', name: 'user-id', type: 'integer'},
      {delimiter: '&&', name: 'my_field', type: 'string'},
    ]);
  });

  it('should parse all supported data types', () => {
    const sql = `SELECT
      $$a:integer$$,
      $$b:string$$,
      $$c:boolean$$,
      $$d:text$$,
      $$e:datetime$$,
      $$f:decimal$$,
      $$g:date$$,
      $$h:json$$,
      $$i:enum$$,
      $$j:uuid$$,
      $$k:ulid$$
    FROM test`;
    const result = parseMagicVariables(sql);
    expect(result).toHaveLength(11);
    expect(result[0].type).toBe('integer');
    expect(result[1].type).toBe('string');
    expect(result[2].type).toBe('boolean');
    expect(result[3].type).toBe('text');
    expect(result[4].type).toBe('datetime');
    expect(result[5].type).toBe('decimal');
    expect(result[6].type).toBe('date');
    expect(result[7].type).toBe('json');
    expect(result[8].type).toBe('enum');
    expect(result[9].type).toBe('uuid');
    expect(result[10].type).toBe('ulid');
  });

  it('should skip unclosed magic variables', () => {
    const result = parseMagicVariables(
      'SELECT * FROM users WHERE id = $$id:integer',
    );
    expect(result).toEqual([]);
  });

  it('should skip mismatched delimiter pairs', () => {
    const result = parseMagicVariables(
      'SELECT * FROM users WHERE id = $$id:integer@@',
    );
    expect(result).toEqual([]);
  });

  it('should return empty array for SQL with no magic variables', () => {
    const result = parseMagicVariables('SELECT * FROM users');
    expect(result).toEqual([]);
  });

  it('should handle empty string', () => {
    const result = parseMagicVariables('');
    expect(result).toEqual([]);
  });

  it('should handle mixed valid and invalid magic variables', () => {
    const sql =
      'SELECT * FROM $$valid:int$$ WHERE x = @@unclosed:string AND y = &&ok:bool&&';
    const result = parseMagicVariables(sql);
    expect(result).toEqual([{delimiter: '$$', name: 'valid', type: 'int'}]);
  });

  it('should handle adjacent magic variables', () => {
    const sql = 'SELECT * FROM $$a:int$$, $$b:int$$';
    const result = parseMagicVariables(sql);
    expect(result).toEqual([
      {delimiter: '$$', name: 'a', type: 'int'},
      {delimiter: '$$', name: 'b', type: 'int'},
    ]);
  });

  it('should extract type as empty string when no type specified', () => {
    const result = parseMagicVariables('SELECT * FROM $$name$$');
    expect(result).toEqual([{delimiter: '$$', name: 'name', type: ''}]);
  });

  it('should take only the first type when multiple colons present', () => {
    const result = parseMagicVariables('SELECT * FROM $$name:int:extra$$');
    expect(result).toEqual([{delimiter: '$$', name: 'name', type: 'int'}]);
  });
});
