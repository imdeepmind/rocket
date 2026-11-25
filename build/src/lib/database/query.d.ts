/**
 * Splits a SQL script into individual statements by semicolon (;), respecting
 * single-quoted string literals, double-quoted identifiers, line comments (--),
 * and block comments (/* ... *\/).
 */
export declare function splitSqlStatements(sql: string): string[];
/**
 * Strips block comments and line comments from a SQL string while preserving
 * characters within quotes.
 */
export declare function stripComments(sql: string): string;
/**
 * Determines whether a SQL query is a SELECT / WITH query.
 */
export declare function isSelectQuery(sql: string): boolean;
/**
 * Determines whether a SQL query is a DML query (SELECT, INSERT, UPDATE, DELETE, WITH).
 */
export declare function isDmlQuery(sql: string): boolean;
/**
 * Determines whether a SQL query is a DDL / non-DML query.
 */
export declare function isDdlQuery(sql: string): boolean;
/**
 * Normalizes PostgreSQL-style parameter placeholders ($1, $2, ...) to SQLite-style (?).
 */
export declare function normalizeSqliteParams(sql: string): string;
/**
 * Normalizes parameter values for SQLite/MySQL drivers.
 */
export declare function normalizeSqliteValue(value: unknown): unknown;
