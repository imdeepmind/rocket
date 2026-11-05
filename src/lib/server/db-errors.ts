import {capitalizeFirstLetter} from '@/utils/string';

export interface ClassifiedDatabaseError {
  statusCode: number;
  message: string;
}

interface DatabaseErrorLike {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
}

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
  const code = (err as DatabaseErrorLike).code;
  return typeof code === 'string' ? code : undefined;
}

function getMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return '';
  const message = (err as DatabaseErrorLike).message;
  return typeof message === 'string' ? message : '';
}

function getDetail(err: unknown): string {
  if (typeof err !== 'object' || err === null) return '';
  const detail = (err as DatabaseErrorLike).detail;
  return typeof detail === 'string' ? detail : '';
}

function isSqliteConnectionCode(code: string): boolean {
  return SQLITE_CONNECTION_CODES.some(
    prefix => code === prefix || code.startsWith(`${prefix}_`),
  );
}

function normalizeFieldList(fields: string): string[] {
  return fields
    .split(',')
    .map(field => field.trim().replace(/^"|"$/g, '').split('.').pop() ?? '')
    .filter(Boolean);
}

/**
 * SQLite reports the affected columns in the message
 * (`UNIQUE constraint failed: users.email`), while PostgreSQL reports both a
 * machine readable code and, usually, a `detail` string such as
 * `Key (email)=(user@example.com) already exists.`.
 */
function getUniqueViolationFields(err: unknown): string[] | null {
  const code = getCode(err) ?? '';
  const message = getMessage(err);

  if (code === '23505') {
    const detailMatch = /Key\s*\(([^)]+)\)\s*=/.exec(getDetail(err));
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
  const code = getCode(err);
  if (!code) return false;

  if (code.startsWith('SQLITE_')) return true;

  return code.length === 5 && DATABASE_SQLSTATE_CLASSES.has(code.slice(0, 2));
}

/**
 * Translates a driver error into a safe, client-facing description. The raw
 * driver code/message is never included in the result.
 */
export function describeDatabaseError(
  err: unknown,
): ClassifiedDatabaseError | null {
  if (!isDatabaseError(err)) return null;

  const code = getCode(err) ?? '';

  const uniqueFields = getUniqueViolationFields(err);
  if (uniqueFields !== null) {
    return {
      statusCode: 409,
      message: buildUniqueViolationMessage(uniqueFields),
    };
  }

  if (code === '23503') {
    return {
      statusCode: 400,
      message: 'The request references a record that does not exist',
    };
  }

  if (code === '23502') {
    return {statusCode: 400, message: 'A required field is missing'};
  }

  if (isSqliteConnectionCode(code)) {
    return {
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    };
  }

  if (code.startsWith('SQLITE_CONSTRAINT')) {
    return {
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    };
  }

  const errorClass = code.slice(0, 2);

  if (errorClass === '23') {
    return {
      statusCode: 400,
      message: 'The provided data violates a database constraint',
    };
  }

  if (errorClass === '22') {
    return {statusCode: 400, message: 'The provided data is invalid'};
  }

  if (errorClass === '08') {
    return {
      statusCode: 503,
      message: 'The service is temporarily unavailable',
    };
  }

  return {statusCode: 500, message: 'Internal Server Error'};
}
