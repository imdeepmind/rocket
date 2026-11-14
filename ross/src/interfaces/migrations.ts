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
