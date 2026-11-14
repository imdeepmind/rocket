const DML_PREFIX_REGEX = /^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
const SELECT_PREFIX_REGEX = /^(SELECT|WITH)\b/i;

/**
 * Splits a SQL script into individual statements by semicolon (;), respecting
 * single-quoted string literals, double-quoted identifiers, line comments (--),
 * and block comments (/* ... *\/).
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') {
        if (next === '"') {
          current += next;
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      current += char + next;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      current += char + next;
      i++;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed && stripComments(trimmed).trim()) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing && stripComments(trailing).trim()) {
    statements.push(trailing);
  }

  return statements;
}

/**
 * Strips block comments and line comments from a SQL string while preserving
 * characters within quotes.
 */
export function stripComments(sql: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      result += char;
      if (char === "'") {
        if (next === "'") {
          result += next;
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      result += char;
      if (char === '"') {
        if (next === '"') {
          result += next;
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      result += char;
      continue;
    }

    result += char;
  }

  return result.trim();
}

/**
 * Determines whether a SQL query is a SELECT / WITH query.
 */
export function isSelectQuery(sql: string): boolean {
  const cleanSql = stripComments(sql).trim();
  return SELECT_PREFIX_REGEX.test(cleanSql);
}

/**
 * Determines whether a SQL query is a DML query (SELECT, INSERT, UPDATE, DELETE, WITH).
 */
export function isDmlQuery(sql: string): boolean {
  const cleanSql = stripComments(sql).trim();
  if (!cleanSql) {
    return true;
  }
  return DML_PREFIX_REGEX.test(cleanSql);
}

/**
 * Determines whether a SQL query is a DDL / non-DML query.
 */
export function isDdlQuery(sql: string): boolean {
  const cleanSql = stripComments(sql).trim();
  if (!cleanSql) {
    return false;
  }
  return !DML_PREFIX_REGEX.test(cleanSql);
}

/**
 * Normalizes PostgreSQL-style parameter placeholders ($1, $2, ...) to SQLite-style (?).
 */
export function normalizeSqliteParams(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

/**
 * Normalizes parameter values for SQLite/MySQL drivers.
 */
export function normalizeSqliteValue(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
