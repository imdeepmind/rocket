import { MigrationRunResult, RunMigrationsOptions } from '../../interfaces/migrations.js';
/**
 * Executes discovered custom migrations within driver-specific transactions,
 * tracks execution state in the _ross_migrations history table, and skips
 * previously executed migrations.
 */
export declare function runCustomMigrations(options: RunMigrationsOptions): Promise<MigrationRunResult>;
