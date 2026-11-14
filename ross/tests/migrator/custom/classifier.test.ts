import {describe, expect, it} from 'vitest';

import {
  classifyMigration,
  isDmlStatement,
  splitSqlStatements,
  stripComments,
} from '@/migrator/custom/classifier';

describe('migrator/custom/classifier', () => {
  describe('splitSqlStatements', () => {
    it('splits multiple statements on semicolons', () => {
      const sql = 'INSERT INTO a VALUES (1); UPDATE b SET x = 2;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual([
        'INSERT INTO a VALUES (1)',
        'UPDATE b SET x = 2',
      ]);
    });

    it('handles single statement with or without trailing semicolon', () => {
      expect(splitSqlStatements('SELECT 1;')).toEqual(['SELECT 1']);
      expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
    });

    it('ignores semicolons inside single-quoted string literals', () => {
      const sql = "INSERT INTO logs (msg) VALUES ('first; second'); SELECT 1;";
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual([
        "INSERT INTO logs (msg) VALUES ('first; second')",
        'SELECT 1',
      ]);
    });

    it('handles escaped quotes inside single-quoted strings', () => {
      const sql = "INSERT INTO authors VALUES ('O''Reilly; author'); SELECT 1;";
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual([
        "INSERT INTO authors VALUES ('O''Reilly; author')",
        'SELECT 1',
      ]);
    });

    it('ignores semicolons inside double-quoted identifiers', () => {
      const sql = 'SELECT "col;name" FROM tbl; DELETE FROM tbl;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual([
        'SELECT "col;name" FROM tbl',
        'DELETE FROM tbl',
      ]);
    });

    it('handles escaped quotes inside double-quoted identifiers', () => {
      const sql = 'SELECT "col""name;test" FROM tbl;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual(['SELECT "col""name;test" FROM tbl']);
    });

    it('ignores semicolons inside line comments', () => {
      const sql = '-- comment with ; semicolon\nSELECT 1;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual(['-- comment with ; semicolon\nSELECT 1']);
    });

    it('ignores semicolons inside block comments', () => {
      const sql = '/* block with ; semicolon */ SELECT 1;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual(['/* block with ; semicolon */ SELECT 1']);
    });

    it('ignores empty statements caused by repeated semicolons', () => {
      const sql = ';;SELECT 1;;;UPDATE a SET b = 1;;;';
      const statements = splitSqlStatements(sql);

      expect(statements).toEqual(['SELECT 1', 'UPDATE a SET b = 1']);
    });
  });

  describe('stripComments', () => {
    it('strips line comments', () => {
      const sql = '-- initial comment\nSELECT * FROM users;\n-- trailing';
      expect(stripComments(sql)).toBe('SELECT * FROM users;');
    });

    it('strips block comments', () => {
      const sql = '/* multi\nline\ncomment */ SELECT 1;';
      expect(stripComments(sql)).toBe('SELECT 1;');
    });

    it('preserves comment markers inside single-quoted strings', () => {
      const sql = "SELECT '-- not a comment', '/* not block */' FROM tbl;";
      expect(stripComments(sql)).toBe(
        "SELECT '-- not a comment', '/* not block */' FROM tbl;",
      );
    });

    it('preserves comment markers inside double-quoted identifiers', () => {
      const sql = 'SELECT "--not_a_comment" FROM tbl;';
      expect(stripComments(sql)).toBe('SELECT "--not_a_comment" FROM tbl;');
    });
  });

  describe('isDmlStatement', () => {
    it.each([
      ['SELECT * FROM users', true],
      ['select id from users', true],
      ['INSERT INTO users (id) VALUES (1)', true],
      ['insert into users values (2)', true],
      ['UPDATE users SET name = "test"', true],
      ['update users set name = "test"', true],
      ['DELETE FROM users WHERE id = 1', true],
      ['delete from users', true],
      ['WITH cte AS (SELECT 1) SELECT * FROM cte', true],
      ['with cte as (select 1) insert into a select * from cte', true],
      ['-- leading comment\nINSERT INTO users VALUES (1)', true],
      ['/* block comment */ UPDATE users SET active = true', true],
      ['', true],
      ['   ', true],
      ['-- comment only', true],
      ['/* block comment only */', true],
    ])('scenario: %s -> %s', (stmt, expected) => {
      expect(isDmlStatement(stmt)).toBe(expected);
    });

    it.each([
      ['CREATE TABLE users (id INT PRIMARY KEY)', false],
      ['create table users (id int)', false],
      ['ALTER TABLE users ADD COLUMN age INT', false],
      ['DROP TABLE users', false],
      ['TRUNCATE TABLE users', false],
      ['CREATE INDEX idx ON users (name)', false],
      ['DROP INDEX idx', false],
      ['GRANT ALL ON users TO test', false],
      ['REVOKE ALL ON users FROM test', false],
      ['-- comment\nCREATE TABLE foo (x INT)', false],
      ['/* comment */ DROP TABLE foo', false],
    ])('classifies non-DML as DDL: %s -> %s', (stmt, expected) => {
      expect(isDmlStatement(stmt)).toBe(expected);
    });
  });

  describe('classifyMigration', () => {
    it('returns containsDDL = false for pure DML files', () => {
      const sql = `
        -- Seed data
        INSERT INTO roles (id, name) VALUES (1, 'admin');
        /* Update status */
        UPDATE users SET role_id = 1 WHERE username = 'root';
        DELETE FROM audit_logs WHERE created_at < '2020-01-01';
      `;

      const result = classifyMigration(sql);
      expect(result.containsDDL).toBe(false);
      expect(result.statements).toHaveLength(3);
    });

    it('returns containsDDL = true when file contains any DDL statement', () => {
      const sql = `
        INSERT INTO roles (name) VALUES ('editor');
        CREATE INDEX IF NOT EXISTS idx_roles_name ON roles (name);
        UPDATE roles SET active = true;
      `;

      const result = classifyMigration(sql);
      expect(result.containsDDL).toBe(true);
      expect(result.statements).toHaveLength(3);
    });

    it('returns containsDDL = false for comment-only file', () => {
      const sql = '-- Just notes\n/* No actual statements */';
      const result = classifyMigration(sql);
      expect(result.containsDDL).toBe(false);
      expect(result.statements).toHaveLength(0);
    });
  });
});
