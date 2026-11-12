import {describe, expect, it} from 'vitest';

import {parseQueryPlaceholders} from '@/lib/sql/placeholders';

describe('parseQueryPlaceholders', () => {
  it('should parse a single path query placeholder', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM users WHERE id = [[path.id:integer]]',
    );
    expect(result).toEqual([
      {
        source: 'path',
        name: 'id',
        type: 'integer',
        raw: '[[path.id:integer]]',
      },
    ]);
  });

  it('should parse a single query query placeholder', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM users WHERE name = [[query.name:string]]',
    );
    expect(result).toEqual([
      {
        source: 'query',
        name: 'name',
        type: 'string',
        raw: '[[query.name:string]]',
      },
    ]);
  });

  it('should parse a single body query placeholder', () => {
    const result = parseQueryPlaceholders(
      'INSERT INTO users (name) VALUES ([[body.name:string]])',
    );
    expect(result).toEqual([
      {
        source: 'body',
        name: 'name',
        type: 'string',
        raw: '[[body.name:string]]',
      },
    ]);
  });

  it('should parse a single header query placeholder', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM users WHERE api_key = [[header.x-api-key:string]]',
    );
    expect(result).toEqual([
      {
        source: 'header',
        name: 'x-api-key',
        type: 'string',
        raw: '[[header.x-api-key:string]]',
      },
    ]);
  });

  it('should not parse unprefixed or magic placeholders', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM orders WHERE user_id = [[userId]] AND org = [[magic.org:string]]',
    );
    expect(result).toEqual([]);
  });

  it('should parse multiple query placeholders of different types', () => {
    const sql =
      'SELECT * FROM users WHERE id = [[path.id:integer]] AND name = [[query.name:string]]';
    const result = parseQueryPlaceholders(sql);
    expect(result).toEqual([
      {
        source: 'path',
        name: 'id',
        type: 'integer',
        raw: '[[path.id:integer]]',
      },
      {
        source: 'query',
        name: 'name',
        type: 'string',
        raw: '[[query.name:string]]',
      },
    ]);
  });

  it('should parse query placeholders with hyphens and underscores in names', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM [[path.user-id:integer]] WHERE [[query.my_field:string]] = ?',
    );
    expect(result).toEqual([
      {
        source: 'path',
        name: 'user-id',
        type: 'integer',
        raw: '[[path.user-id:integer]]',
      },
      {
        source: 'query',
        name: 'my_field',
        type: 'string',
        raw: '[[query.my_field:string]]',
      },
    ]);
  });

  it('should parse all supported data types', () => {
    const sql = `SELECT 
      [[path.a:integer]], 
      [[path.b:string]], 
      [[path.c:boolean]], 
      [[path.d:text]], 
      [[path.e:datetime]], 
      [[path.f:decimal]], 
      [[path.g:date]], 
      [[path.h:json]], 
      [[path.i:enum]], 
      [[path.j:uuid]], 
      [[path.k:ulid]] 
    FROM test`;
    const result = parseQueryPlaceholders(sql);
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

  it('should skip unclosed query placeholders', () => {
    const result = parseQueryPlaceholders(
      'SELECT * FROM users WHERE id = [[path.id:integer',
    );
    expect(result).toEqual([]);
  });

  it('should return empty array for SQL with no query placeholders', () => {
    const result = parseQueryPlaceholders('SELECT * FROM users');
    expect(result).toEqual([]);
  });

  it('should return empty array for SQL with PostgreSQL dollar-quotes or text search', () => {
    const result = parseQueryPlaceholders(
      "SELECT * FROM articles WHERE to_tsvector('english', body) @@ to_tsquery('rocket') AND $$quote$$ = 1",
    );
    expect(result).toEqual([]);
  });

  it('should handle empty string', () => {
    const result = parseQueryPlaceholders('');
    expect(result).toEqual([]);
  });

  it('should handle unclosed placeholder followed by a valid one', () => {
    const sql =
      'SELECT * FROM [[unclosed WHERE x = [[path.valid:integer]] AND y = [[query.ok:boolean]]';
    const result = parseQueryPlaceholders(sql);
    expect(result).toEqual([
      {
        source: 'path',
        name: 'valid',
        type: 'integer',
        raw: '[[path.valid:integer]]',
      },
      {
        source: 'query',
        name: 'ok',
        type: 'boolean',
        raw: '[[query.ok:boolean]]',
      },
    ]);
  });

  it('should handle adjacent query placeholders', () => {
    const sql = 'SELECT * FROM [[path.a:integer]], [[path.b:integer]]';
    const result = parseQueryPlaceholders(sql);
    expect(result).toEqual([
      {source: 'path', name: 'a', type: 'integer', raw: '[[path.a:integer]]'},
      {source: 'path', name: 'b', type: 'integer', raw: '[[path.b:integer]]'},
    ]);
  });
});
