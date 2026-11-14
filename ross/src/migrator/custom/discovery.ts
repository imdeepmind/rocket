import * as fs from 'fs';
import * as path from 'path';

import {DBEngine} from '@/interfaces/config';
import {
  DiscoveredMigration,
  DiscoverMigrationsOptions,
} from '@/interfaces/migrations';

import {computeChecksum} from '@/utils/checksum';

import {classifyMigration} from './classifier';

const MIGRATION_FILE_REGEX = /^(\d+)_(.+)\.sql$/;
const KNOWN_ENGINES: DBEngine[] = ['postgres', 'mysql', 'sqlite'];

/**
 * Discovers, validates, sorts, and classifies custom SQL migration files
 * across common and engine-specific directories.
 */
export function discoverMigrations(
  options: DiscoverMigrationsOptions,
): DiscoveredMigration[] {
  const {migrationsDir, engine} = options;

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migration directory "${migrationsDir}" does not exist.`);
  }

  const stat = fs.statSync(migrationsDir);
  if (!stat.isDirectory()) {
    throw new Error(`Migration path "${migrationsDir}" is not a directory.`);
  }

  const entries = fs.readdirSync(migrationsDir, {withFileTypes: true});
  const rawList: Omit<
    DiscoveredMigration,
    'content' | 'checksum' | 'containsDDL'
  >[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (KNOWN_ENGINES.includes(entry.name as DBEngine)) {
        if (entry.name === engine) {
          const engineDir = path.join(migrationsDir, entry.name);
          const subEntries = fs.readdirSync(engineDir, {withFileTypes: true});

          for (const subEntry of subEntries) {
            if (subEntry.isDirectory()) {
              throw new Error(
                `Invalid migration entry "${entry.name}/${subEntry.name}". Nested subdirectories inside engine directories are not supported.`,
              );
            }

            const match = subEntry.name.match(MIGRATION_FILE_REGEX);
            if (!match) {
              throw new Error(
                `Invalid migration filename "${entry.name}/${subEntry.name}". Migration files must match "<number>_<description>.sql".`,
              );
            }

            const prefix = parseInt(match[1], 10);
            rawList.push({
              id: `${entry.name}/${subEntry.name}`,
              name: subEntry.name,
              prefix,
              filePath: path.join(engineDir, subEntry.name),
              engine,
            });
          }
        }
        // Subdirectories for non-matching engines are intentionally ignored.
      } else {
        throw new Error(
          `Unexpected directory "${entry.name}" in migrations directory. Only engine subdirectories (postgres, mysql, sqlite) are supported.`,
        );
      }
    } else if (entry.isFile()) {
      const match = entry.name.match(MIGRATION_FILE_REGEX);
      if (!match) {
        throw new Error(
          `Invalid migration filename "${entry.name}". Migration files must match "<number>_<description>.sql".`,
        );
      }

      const prefix = parseInt(match[1], 10);
      rawList.push({
        id: entry.name,
        name: entry.name,
        prefix,
        filePath: path.join(migrationsDir, entry.name),
        engine: undefined,
      });
    }
  }

  // Check for duplicate numeric integer prefixes
  const prefixMap = new Map<number, string>();
  for (const migration of rawList) {
    const existingId = prefixMap.get(migration.prefix);
    if (existingId) {
      throw new Error(
        `Duplicate migration numeric prefix "${migration.prefix}" detected between "${existingId}" and "${migration.id}".`,
      );
    }
    prefixMap.set(migration.prefix, migration.id);
  }

  // Sort by integer prefix ascending (e.g. 9 precedes 10)
  rawList.sort((a, b) => a.prefix - b.prefix);

  // Read content, compute checksum, and classify DML/DDL
  const migrations: DiscoveredMigration[] = rawList.map(item => {
    const content = fs.readFileSync(item.filePath, 'utf8');
    const checksum = computeChecksum(content);
    const {containsDDL} = classifyMigration(content);

    return {
      ...item,
      content,
      checksum,
      containsDDL,
    };
  });

  return migrations;
}

/**
 * Validates that discovered migrations adhere to the DDL safety constraints.
 * If containsDDL is true and dangerouslyAllowDDL is false, execution halts.
 */
export function validateMigrations(
  migrations: DiscoveredMigration[],
  dangerouslyAllowDDL = false,
): void {
  if (dangerouslyAllowDDL) {
    return;
  }

  const ddlMigration = migrations.find(m => m.containsDDL);
  if (ddlMigration) {
    throw new Error(
      `Migration "${ddlMigration.id}" contains non-DML/DDL statements. Custom migrations only permit data operations by default. Use --dangerously-allow-ddl to allow this at your own risk.`,
    );
  }
}
