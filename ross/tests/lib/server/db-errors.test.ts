import {describe, expect, test} from 'vitest';

import {describeDatabaseError, isDatabaseError} from '@/lib/server/db-errors';

const pgError = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error('raw postgres driver message'), {code, ...extra});

const sqliteError = (code: string, message = 'raw sqlite driver message') =>
  Object.assign(new Error(message), {code});

describe('isDatabaseError', () => {
  test('should return false for values without a string code', () => {
    expect(isDatabaseError(null)).toBe(false);
    expect(isDatabaseError('error')).toBe(false);
    expect(isDatabaseError({})).toBe(false);
    expect(isDatabaseError({code: 23505})).toBe(false);
  });

  test('should return false for unrelated application codes', () => {
    expect(isDatabaseError({code: '99999'})).toBe(false);
    expect(isDatabaseError({code: 'FST_ERR_VALIDATION'})).toBe(false);
  });

  test('should recognize PostgreSQL SQLSTATE classes', () => {
    expect(isDatabaseError({code: '23505'})).toBe(true);
    expect(isDatabaseError({code: '42P01'})).toBe(true);
    expect(isDatabaseError({code: '08001'})).toBe(true);
    expect(isDatabaseError({code: '28000'})).toBe(true);
  });

  test('should recognize SQLite driver codes', () => {
    expect(isDatabaseError({code: 'SQLITE_CONSTRAINT_UNIQUE'})).toBe(true);
    expect(isDatabaseError({code: 'SQLITE_BUSY'})).toBe(true);
  });

  test('should recognize SqliteError by name or constraint message', () => {
    expect(isDatabaseError({name: 'SqliteError'})).toBe(true);
    expect(isDatabaseError(new Error('FOREIGN KEY constraint failed'))).toBe(
      true,
    );
    expect(isDatabaseError(new Error('NOT NULL constraint failed: name'))).toBe(
      true,
    );
    expect(
      isDatabaseError(new Error('CHECK constraint failed: age >= 0')),
    ).toBe(true);
    expect(isDatabaseError(new Error('near "SELEC": syntax error'))).toBe(true);
  });
});

describe('describeDatabaseError', () => {
  test('should return null for non-database errors', () => {
    expect(describeDatabaseError(new Error('boom'))).toBeNull();
    expect(describeDatabaseError({code: 'FST_ERR_VALIDATION'})).toBeNull();
  });

  test('should build a column-aware message for PostgreSQL unique violations', () => {
    const err = pgError('23505', {
      detail: 'Key (email)=(user@example.com) already exists.',
    });

    expect(describeDatabaseError(err)).toEqual({
      statusCode: 409,
      message: 'Email already exists',
    });
  });

  test('should use a generic message when PostgreSQL omits the detail', () => {
    expect(describeDatabaseError(pgError('23505'))).toEqual({
      statusCode: 409,
      message: 'A record with this value already exists',
    });
  });

  test('should handle multiple PostgreSQL unique columns', () => {
    const err = pgError('23505', {
      detail: 'Key ("email", username)=(a@example.com, alice) already exists.',
    });

    expect(describeDatabaseError(err)).toEqual({
      statusCode: 409,
      message: 'A record with these values already exists',
    });
  });

  test('should parse SQLite unique violation messages', () => {
    expect(
      describeDatabaseError(
        sqliteError(
          'SQLITE_CONSTRAINT_UNIQUE',
          'UNIQUE constraint failed: users.email',
        ),
      ),
    ).toEqual({statusCode: 409, message: 'Email already exists'});
  });

  test('should parse schema-qualified SQLite columns', () => {
    expect(
      describeDatabaseError(
        sqliteError(
          'SQLITE_CONSTRAINT_UNIQUE',
          'UNIQUE constraint failed: main.users.email',
        ),
      ),
    ).toEqual({statusCode: 409, message: 'Email already exists'});
  });

  test('should handle SQLite primary key violations', () => {
    expect(
      describeDatabaseError(
        sqliteError(
          'SQLITE_CONSTRAINT_PRIMARYKEY',
          'UNIQUE constraint failed: users.id',
        ),
      ),
    ).toEqual({statusCode: 409, message: 'Id already exists'});
  });

  test('should detect SQLite unique violations from the message alone', () => {
    expect(
      describeDatabaseError(
        sqliteError(
          'SQLITE_CONSTRAINT',
          'UNIQUE constraint failed: users.email, users.username',
        ),
      ),
    ).toEqual({
      statusCode: 409,
      message: 'A record with these values already exists',
    });
  });

  test('should use a generic message when SQLite does not expose columns', () => {
    expect(describeDatabaseError({code: 'SQLITE_CONSTRAINT_UNIQUE'})).toEqual({
      statusCode: 409,
      message: 'A record with this value already exists',
    });
  });

  test('should ignore empty column names parsed from SQLite messages', () => {
    expect(
      describeDatabaseError({
        code: 'SQLITE_CONSTRAINT_UNIQUE',
        message: 'UNIQUE constraint failed: users.email, ',
      }),
    ).toEqual({statusCode: 409, message: 'Email already exists'});
  });

  test('should map PostgreSQL foreign key violations to 400', () => {
    expect(describeDatabaseError(pgError('23503'))).toEqual({
      statusCode: 400,
      message: 'The request references a record that does not exist',
    });
  });

  test('should map PostgreSQL not-null violations to 400', () => {
    expect(describeDatabaseError(pgError('23502'))).toEqual({
      statusCode: 400,
      message: 'A required field is missing',
    });
  });

  test('should map other PostgreSQL integrity violations to 400', () => {
    expect(describeDatabaseError(pgError('23514'))).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
    expect(describeDatabaseError(pgError('23001'))).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
  });

  test('should map PostgreSQL data exceptions to 400', () => {
    expect(describeDatabaseError(pgError('22P02'))).toEqual({
      statusCode: 400,
      message: 'The provided data is invalid',
    });
  });

  test('should map PostgreSQL connection exceptions to 503', () => {
    expect(describeDatabaseError(pgError('08001'))).toEqual({
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    });
  });

  test('should map SQLite foreign key violations to 400 with a friendly message', () => {
    expect(
      describeDatabaseError(sqliteError('SQLITE_CONSTRAINT_FOREIGNKEY')),
    ).toEqual({
      statusCode: 400,
      message: 'The request references a record that does not exist',
    });
    expect(
      describeDatabaseError(
        sqliteError('SQLITE_CONSTRAINT', 'FOREIGN KEY constraint failed'),
      ),
    ).toEqual({
      statusCode: 400,
      message: 'The request references a record that does not exist',
    });
  });

  test('should map SQLite not-null violations to 400 with a friendly message', () => {
    expect(
      describeDatabaseError(sqliteError('SQLITE_CONSTRAINT_NOTNULL')),
    ).toEqual({
      statusCode: 400,
      message: 'A required field is missing',
    });
    expect(
      describeDatabaseError(
        sqliteError(
          'SQLITE_CONSTRAINT',
          'NOT NULL constraint failed: users.name',
        ),
      ),
    ).toEqual({
      statusCode: 400,
      message: 'A required field is missing',
    });
  });

  test('should map SQLite check constraint violations to 400', () => {
    expect(
      describeDatabaseError(sqliteError('SQLITE_CONSTRAINT_CHECK')),
    ).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
    expect(
      describeDatabaseError(
        sqliteError('SQLITE_CONSTRAINT', 'CHECK constraint failed: age >= 0'),
      ),
    ).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
  });

  test('should map other SQLite constraint violations to 400', () => {
    expect(
      describeDatabaseError(sqliteError('SQLITE_CONSTRAINT_TRIGGER')),
    ).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
    expect(describeDatabaseError(sqliteError('SQLITE_CONSTRAINT'))).toEqual({
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    });
  });

  test('should map SQLite connection errors to 503', () => {
    expect(describeDatabaseError(sqliteError('SQLITE_BUSY'))).toEqual({
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    });
    expect(describeDatabaseError(sqliteError('SQLITE_IOERR_READ'))).toEqual({
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    });
  });

  test('should hide unclassified database errors behind a generic 500', () => {
    expect(describeDatabaseError(pgError('42P01'))).toEqual({
      statusCode: 500,
      message: 'Internal Server Error',
    });
    expect(describeDatabaseError(sqliteError('SQLITE_ERROR'))).toEqual({
      statusCode: 500,
      message: 'Internal Server Error',
    });
    expect(
      describeDatabaseError(
        Object.assign(new Error('near "SELEC": syntax error'), {
          name: 'SqliteError',
        }),
      ),
    ).toEqual({
      statusCode: 500,
      message: 'Internal Server Error',
    });
  });
});
