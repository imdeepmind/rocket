import { DiscoveredMigration, DiscoverMigrationsOptions } from '../../interfaces/migrations.js';
/**
 * Discovers, validates, sorts, and classifies custom SQL migration files
 * across common and engine-specific directories.
 */
export declare function discoverMigrations(options: DiscoverMigrationsOptions): DiscoveredMigration[];
/**
 * Validates that discovered migrations adhere to the DDL safety constraints.
 * If containsDDL is true and dangerouslyAllowDDL is false, execution halts.
 */
export declare function validateMigrations(migrations: DiscoveredMigration[], dangerouslyAllowDDL?: boolean): void;
