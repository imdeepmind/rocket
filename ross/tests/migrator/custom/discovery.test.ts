import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  discoverMigrations,
  validateMigrations,
} from '@/migrator/custom/discovery';

describe('migrator/custom/discovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-migrations-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('throws descriptive error if migrations directory does not exist', () => {
    const nonExistent = path.join(tmpDir, 'does-not-exist');
    expect(() =>
      discoverMigrations({
        migrationsDir: nonExistent,
        engine: 'postgres',
      }),
    ).toThrow(`Migration directory "${nonExistent}" does not exist.`);
  });

  it('throws descriptive error if migrations path is a file', () => {
    const filePath = path.join(tmpDir, 'file.txt');
    fs.writeFileSync(filePath, 'hello');

    expect(() =>
      discoverMigrations({
        migrationsDir: filePath,
        engine: 'postgres',
      }),
    ).toThrow(`Migration path "${filePath}" is not a directory.`);
  });

  it('discovers common migrations and engine-specific migrations for the active engine', () => {
    // Common migrations
    fs.writeFileSync(
      path.join(tmpDir, '001_seed_roles.sql'),
      "INSERT INTO roles VALUES (1, 'admin');",
    );
    fs.writeFileSync(
      path.join(tmpDir, '003_seed_users.sql'),
      "INSERT INTO users VALUES (1, 'root');",
    );

    // Postgres migrations
    const pgDir = path.join(tmpDir, 'postgres');
    fs.mkdirSync(pgDir);
    fs.writeFileSync(
      path.join(pgDir, '002_pg_json.sql'),
      "UPDATE users SET metadata = '{}'::jsonb;",
    );

    // MySQL migrations (should be ignored when engine is postgres)
    const mysqlDir = path.join(tmpDir, 'mysql');
    fs.mkdirSync(mysqlDir);
    fs.writeFileSync(
      path.join(mysqlDir, '002_mysql_dates.sql'),
      'UPDATE users SET created_at = NOW();',
    );

    const migrations = discoverMigrations({
      migrationsDir: tmpDir,
      engine: 'postgres',
    });

    expect(migrations).toHaveLength(3);

    expect(migrations[0].id).toBe('001_seed_roles.sql');
    expect(migrations[0].prefix).toBe(1);
    expect(migrations[0].engine).toBeUndefined();
    expect(migrations[0].containsDDL).toBe(false);

    expect(migrations[1].id).toBe('postgres/002_pg_json.sql');
    expect(migrations[1].prefix).toBe(2);
    expect(migrations[1].engine).toBe('postgres');
    expect(migrations[1].containsDDL).toBe(false);

    expect(migrations[2].id).toBe('003_seed_users.sql');
    expect(migrations[2].prefix).toBe(3);
    expect(migrations[2].engine).toBeUndefined();
    expect(migrations[2].containsDDL).toBe(false);
  });

  it('sorts migrations numerically rather than lexicographically (9 before 10)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '10_update_ten.sql'),
      'UPDATE t SET x = 10;',
    );
    fs.writeFileSync(
      path.join(tmpDir, '9_update_nine.sql'),
      'UPDATE t SET x = 9;',
    );
    fs.writeFileSync(
      path.join(tmpDir, '01_update_one.sql'),
      'UPDATE t SET x = 1;',
    );

    const migrations = discoverMigrations({
      migrationsDir: tmpDir,
      engine: 'sqlite',
    });

    expect(migrations.map(m => m.prefix)).toEqual([1, 9, 10]);
    expect(migrations.map(m => m.name)).toEqual([
      '01_update_one.sql',
      '9_update_nine.sql',
      '10_update_ten.sql',
    ]);
  });

  it('fails discovery when an invalid filename is present in root', () => {
    fs.writeFileSync(path.join(tmpDir, 'no_numeric_prefix.sql'), 'SELECT 1;');

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'postgres',
      }),
    ).toThrow(
      'Invalid migration filename "no_numeric_prefix.sql". Migration files must match "<number>_<description>.sql".',
    );
  });

  it('fails discovery when a non-sql file is present in root', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'docs');

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'postgres',
      }),
    ).toThrow(
      'Invalid migration filename "README.md". Migration files must match "<number>_<description>.sql".',
    );
  });

  it('fails discovery when an invalid filename is present in active engine directory', () => {
    const pgDir = path.join(tmpDir, 'postgres');
    fs.mkdirSync(pgDir);
    fs.writeFileSync(path.join(pgDir, 'invalid.sql'), 'SELECT 1;');

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'postgres',
      }),
    ).toThrow(
      'Invalid migration filename "postgres/invalid.sql". Migration files must match "<number>_<description>.sql".',
    );
  });

  it('fails discovery when a nested directory exists in active engine directory', () => {
    const pgDir = path.join(tmpDir, 'postgres');
    const nestedDir = path.join(pgDir, 'nested');
    fs.mkdirSync(nestedDir, {recursive: true});

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'postgres',
      }),
    ).toThrow(
      'Invalid migration entry "postgres/nested". Nested subdirectories inside engine directories are not supported.',
    );
  });

  it('fails discovery when an unexpected non-engine directory exists in migrations root', () => {
    const unknownDir = path.join(tmpDir, 'helpers');
    fs.mkdirSync(unknownDir);

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'sqlite',
      }),
    ).toThrow(
      'Unexpected directory "helpers" in migrations directory. Only engine subdirectories (postgres, mysql, sqlite) are supported.',
    );
  });

  it('fails discovery when duplicate numeric prefixes exist across common migrations', () => {
    fs.writeFileSync(
      path.join(tmpDir, '01_first.sql'),
      'INSERT INTO a VALUES (1);',
    );
    fs.writeFileSync(
      path.join(tmpDir, '1_duplicate.sql'),
      'INSERT INTO a VALUES (2);',
    );

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'sqlite',
      }),
    ).toThrow(
      'Duplicate migration numeric prefix "1" detected between "01_first.sql" and "1_duplicate.sql".',
    );
  });

  it('fails discovery when duplicate numeric prefix collides between common and engine directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '002_common.sql'),
      'INSERT INTO a VALUES (1);',
    );
    const sqliteDir = path.join(tmpDir, 'sqlite');
    fs.mkdirSync(sqliteDir);
    fs.writeFileSync(
      path.join(sqliteDir, '2_sqlite.sql'),
      'INSERT INTO a VALUES (2);',
    );

    expect(() =>
      discoverMigrations({
        migrationsDir: tmpDir,
        engine: 'sqlite',
      }),
    ).toThrow(
      'Duplicate migration numeric prefix "2" detected between "002_common.sql" and "sqlite/2_sqlite.sql".',
    );
  });

  it('correctly tags containsDDL for files with DDL statements', () => {
    fs.writeFileSync(
      path.join(tmpDir, '001_ddl.sql'),
      'CREATE TABLE foo (id INT);',
    );

    const migrations = discoverMigrations({
      migrationsDir: tmpDir,
      engine: 'sqlite',
    });

    expect(migrations[0].containsDDL).toBe(true);
  });

  describe('validateMigrations', () => {
    it('passes when no migrations contain DDL', () => {
      const migrations = [
        {
          id: '001_dml.sql',
          name: '001_dml.sql',
          prefix: 1,
          filePath: '/test/001_dml.sql',
          content: 'INSERT INTO a VALUES (1);',
          checksum: 'abc',
          containsDDL: false,
        },
      ];

      expect(() => validateMigrations(migrations, false)).not.toThrow();
    });

    it('passes when a migration contains DDL but dangerouslyAllowDDL is true', () => {
      const migrations = [
        {
          id: '001_ddl.sql',
          name: '001_ddl.sql',
          prefix: 1,
          filePath: '/test/001_ddl.sql',
          content: 'CREATE TABLE a (id INT);',
          checksum: 'abc',
          containsDDL: true,
        },
      ];

      expect(() => validateMigrations(migrations, true)).not.toThrow();
    });

    it('throws descriptive error when a migration contains DDL and dangerouslyAllowDDL is false', () => {
      const migrations = [
        {
          id: '001_ddl.sql',
          name: '001_ddl.sql',
          prefix: 1,
          filePath: '/test/001_ddl.sql',
          content: 'CREATE TABLE a (id INT);',
          checksum: 'abc',
          containsDDL: true,
        },
      ];

      expect(() => validateMigrations(migrations, false)).toThrow(
        'Migration "001_ddl.sql" contains non-DML/DDL statements. Custom migrations only permit data operations by default. Use --dangerously-allow-ddl to allow this at your own risk.',
      );
    });
  });
});
