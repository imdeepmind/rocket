import { ClassifiedDatabaseError } from '../../interfaces/database.js';
export declare function isDatabaseError(err: unknown): boolean;
/**
 * Translates a driver error into a safe, client-facing description. The raw
 * driver code/message is never included in the result.
 */
export declare function describeDatabaseError(err: unknown): ClassifiedDatabaseError | null;
