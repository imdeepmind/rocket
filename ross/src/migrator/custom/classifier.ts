import {
  isDdlQuery,
  isDmlQuery,
  splitSqlStatements,
  stripComments,
} from '@/lib/database/query';

export {splitSqlStatements, stripComments};

/**
 * Checks whether a single SQL statement matches the allowed DML prefixes:
 * SELECT, INSERT, UPDATE, DELETE, WITH.
 */
export function isDmlStatement(statement: string): boolean {
  return isDmlQuery(statement);
}

/**
 * Classifies a migration file's SQL content into individual statements and
 * determines if it contains any non-DML (DDL) operations.
 */
export function classifyMigration(sql: string): {
  containsDDL: boolean;
  statements: string[];
} {
  const statements = splitSqlStatements(sql);

  for (const stmt of statements) {
    if (isDdlQuery(stmt)) {
      return {containsDDL: true, statements};
    }
  }

  return {containsDDL: false, statements};
}
