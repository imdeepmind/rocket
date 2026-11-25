import { splitSqlStatements, stripComments } from '../../lib/database/query.js';
export { splitSqlStatements, stripComments };
/**
 * Checks whether a single SQL statement matches the allowed DML prefixes:
 * SELECT, INSERT, UPDATE, DELETE, WITH.
 */
export declare function isDmlStatement(statement: string): boolean;
/**
 * Classifies a migration file's SQL content into individual statements and
 * determines if it contains any non-DML (DDL) operations.
 */
export declare function classifyMigration(sql: string): {
    containsDDL: boolean;
    statements: string[];
};
