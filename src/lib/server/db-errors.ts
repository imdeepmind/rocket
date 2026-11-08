import {ClassifiedDatabaseError, DatabaseErrorLike} from '@/interfaces';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * SQLSTATE classes that identify an error coming from the database engine.
 * We only classify codes from these classes so unrelated application error
 * codes (e.g. Fastify's `FST_*`) keep their existing behavior.
 */
const DATABASE_SQLSTATE_CLASSES = new Set([
  '08', // connection exception
  '22', // data exception
  '23', // integrity constraint violation
  '28', // invalid authorization specification
  '3D', // invalid catalog name
  '3F', // invalid schema name
  '40', // transaction rollback
  '42', // syntax error or access rule violation
  '44', // with check option violation
  '53', // insufficient resources
  '54', // program limit exceeded
  '55', // object not in prerequisite state
  '57', // operator intervention
  '58', // system error
  '72', // snapshot failure
  'F0', // configuration file error
  'HV', // foreign data wrapper error
  'P0', // PL/pgSQL error
  'XX', // internal error
]);

const SQLITE_CONNECTION_CODES = [
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_CANTOPEN',
  'SQLITE_IOERR',
  'SQLITE_PROTOCOL',
  'SQLITE_NOTADB',
  'SQLITE_CORRUPT',
  'SQLITE_FULL',
];

function getCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as {code?: unknown}).code;
  return typeof code === 'string' ? code : undefined;
}

function getStringField(
  error: DatabaseErrorLike,
  field: 'message' | 'detail',
): string {
  const value = error[field];
  return typeof value === 'string' ? value : '';
}

function isSqliteConnectionCode(code: string): boolean {
  if (!code) return false;
  return SQLITE_CONNECTION_CODES.some(
    prefix => code === prefix || code.startsWith(`${prefix}_`),
  );
}

function normalizeFieldList(fields: string): string[] {
  return fields
    .split(',')
    .map(field => {
      const parts = field.trim().replace(/^"|"$/g, '').split('.');
      return parts[parts.length - 1];
    })
    .filter(Boolean);
}

/**
 * SQLite reports the affected columns in the message
 * (`UNIQUE constraint failed: users.email`), while PostgreSQL reports both a
 * machine readable code and, usually, a `detail` string such as
 * `Key (email)=(user@example.com) already exists.`.
 */
function getUniqueViolationFields(
  error: DatabaseErrorLike,
  code: string,
): string[] | null {
  const message = getStringField(error, 'message');

  if (code === '23505') {
    const detailMatch = /Key\s*\(([^)]+)\)\s*=/.exec(
      getStringField(error, 'detail'),
    );
    return detailMatch ? normalizeFieldList(detailMatch[1]) : [];
  }

  const sqliteUnique =
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    /UNIQUE constraint failed/i.test(message);

  if (sqliteUnique) {
    const messageMatch = /UNIQUE constraint failed:\s*(.+)$/i.exec(message);
    return messageMatch ? normalizeFieldList(messageMatch[1]) : [];
  }

  return null;
}

function buildUniqueViolationMessage(fields: string[]): string {
  if (fields.length === 1) {
    return `${capitalizeFirstLetter(fields[0])} already exists`;
  }
  if (fields.length > 1) {
    return 'A record with these values already exists';
  }
  return 'A record with this value already exists';
}

export function isDatabaseError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const errorObj = err as {code?: unknown; name?: unknown; message?: unknown};
  const code = typeof errorObj.code === 'string' ? errorObj.code : undefined;

  if (code) {
    if (code.startsWith('SQLITE_')) return true;
    if (code.length === 5 && DATABASE_SQLSTATE_CLASSES.has(code.slice(0, 2))) {
      return true;
    }
  }

  if (errorObj.name === 'SqliteError') return true;

  if (typeof errorObj.message === 'string') {
    if (/(constraint failed|syntax error)/i.test(errorObj.message)) {
      return true;
    }
  }

  return false;
}

/**
 * Translates a driver error into a safe, client-facing description. The raw
 * driver code/message is never included in the result.
 */
export function describeDatabaseError(
  err: unknown,
): ClassifiedDatabaseError | null {
  if (!isDatabaseError(err)) return null;

  const error = err as DatabaseErrorLike;
  const code = getCode(err) ?? '';
  const message = getStringField(error, 'message');

  const uniqueFields = getUniqueViolationFields(error, code);
  if (uniqueFields !== null) {
    return {
      statusCode: 409,
      message: buildUniqueViolationMessage(uniqueFields),
    };
  }

  // Foreign key violations
  if (
    code === '23503' ||
    code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    /FOREIGN KEY constraint failed/i.test(message)
  ) {
    return {
      statusCode: 400,
      message: 'The request references a record that does not exist',
    };
  }

  // Not null violations
  if (
    code === '23502' ||
    code === 'SQLITE_CONSTRAINT_NOTNULL' ||
    /NOT NULL constraint failed/i.test(message)
  ) {
    return {statusCode: 400, message: 'A required field is missing'};
  }

  // Check violations
  if (
    code === '23514' ||
    code === 'SQLITE_CONSTRAINT_CHECK' ||
    /CHECK constraint failed/i.test(message)
  ) {
    return {
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    };
  }

  // Connection / busy exceptions
  if (
    isSqliteConnectionCode(code) ||
    (code.length === 5 && code.slice(0, 2) === '08')
  ) {
    return {
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    };
  }

  // Generic or other constraint violations
  if (
    code.startsWith('SQLITE_CONSTRAINT') ||
    (code.length === 5 && code.slice(0, 2) === '23')
  ) {
    return {
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    };
  }

  // Data exceptions
  if (code.length === 5 && code.slice(0, 2) === '22') {
    return {statusCode: 400, message: 'The provided data is invalid'};
  }

  return {statusCode: 500, message: 'Internal Server Error'};
}
