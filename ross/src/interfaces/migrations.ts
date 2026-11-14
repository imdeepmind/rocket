import {DBEngine} from '@/interfaces/config';

export interface DiscoveredMigration {
  id: string;
  name: string;
  prefix: number;
  filePath: string;
  content: string;
  checksum: string;
  containsDDL: boolean;
  engine?: DBEngine;
}

export interface DiscoverMigrationsOptions {
  migrationsDir: string;
  engine: DBEngine;
  dangerouslyAllowDDL?: boolean;
}

export interface MigrationHistoryRecord {
  id: string;
  checksum: string;
  contains_ddl: boolean;
  executed_at: string | Date;
}

export interface RunMigrationsOptions {
  migrations: DiscoveredMigration[];
  engine: DBEngine;
  connectionUrl: string;
  dangerouslyAllowDDL?: boolean;
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}
