import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

import {AppConfig, DBEngine, ModelConfig} from '@/schema/config';

function generateSchemaFile(config: ModelConfig, engine: DBEngine): string {
  if (engine === 'sqlite') {
    const columns = config.fields
      .map(f => {
        let col = '';
        switch (f.type) {
          case 'integer':
          case 'boolean':
            col = `integer('${f.name}')`;
            break;
          case 'string':
          case 'text':
            col = `text('${f.name}')`;
            break;
          case 'datetime':
            col = `integer('${f.name}', { mode: 'timestamp' })`;
            break;
          default:
            col = `text('${f.name}')`;
            break; // fallback
        }
        if (f.primaryKey) col += '.primaryKey({ autoIncrement: true })';
        if (f.unique && !f.primaryKey) col += '.unique()';
        if (f.nullable === false) col += '.notNull()';
        if (f.default !== undefined)
          col += `.default(${JSON.stringify(f.default)})`;
        return `    ${f.name}: ${col}`;
      })
      .join(',\n');

    const indexes = (config.indexes ?? [])
      .map(idx => {
        const cols = idx.columns.map(c => `t.${c}`).join(', ');
        return idx.unique
          ? `    uniqueIndex('${idx.name}').on(${cols})`
          : `    index('${idx.name}').on(${cols})`;
      })
      .join(',\n');

    return `
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const ${config.name} = sqliteTable('${config.name}', {
${columns}
}${indexes ? `, (t) => [\n${indexes}\n]` : ''});
`.trim();
  } else {
    const columns = config.fields
      .map(f => {
        let col = '';
        switch (f.type) {
          case 'integer':
            col = f.primaryKey ? `serial('${f.name}')` : `integer('${f.name}')`;
            break;
          case 'string':
          case 'text':
            col = `text('${f.name}')`;
            break;
          case 'boolean':
            col = `boolean('${f.name}')`;
            break;
          case 'datetime':
            col = `timestamp('${f.name}')`;
            break;
          default:
            col = `text('${f.name}')`;
            break; // fallback
        }
        if (f.primaryKey) col += '.primaryKey()';
        if (f.unique && !f.primaryKey) col += '.unique()';
        if (f.nullable === false) col += '.notNull()';
        if (f.default !== undefined)
          col += `.default(${JSON.stringify(f.default)})`;
        return `    ${f.name}: ${col}`;
      })
      .join(',\n');

    const indexes = (config.indexes ?? [])
      .map(idx => {
        const cols = idx.columns.map(c => `t.${c}`).join(', ');
        return idx.unique
          ? `    uniqueIndex('${idx.name}').on(${cols})`
          : `    index('${idx.name}').on(${cols})`;
      })
      .join(',\n');

    return `
import { pgTable, serial, integer, text, boolean, doublePrecision, index, uniqueIndex, timestamp } from 'drizzle-orm/pg-core';

export const ${config.name} = pgTable('${config.name}', {
${columns}
}${indexes ? `, (t) => [\n${indexes}\n]` : ''});
`.trim();
  }
}

async function generateMigrationSQL(
  config: ModelConfig[],
  engine: DBEngine,
  dbUrl: string,
): Promise<void> {
  let tmpDir: string | undefined;

  try {
    // Make sure test_data exists
    const testDataPath = path.join(process.cwd(), '.migrations');
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, {recursive: true});
    }

    tmpDir = fs.mkdtempSync(path.join(testDataPath, 'drizzle-'));
    const schemaPath = path.join(tmpDir, 'schema.ts');
    const migrationsPath = path.join(tmpDir, 'migrations');
    const configPath = path.join(tmpDir, 'drizzle.config.ts');

    const schemas = [];

    for (const model of config) {
      schemas.push(generateSchemaFile(model, engine));
    }

    // write schema.ts
    fs.writeFileSync(schemaPath, schemas.join('\n'));

    // write drizzle.config.ts
    fs.writeFileSync(
      configPath,
      `
      import { defineConfig } from 'drizzle-kit';
      export default defineConfig({
        dialect: '${engine === 'pg' ? 'postgresql' : 'sqlite'}',
        schema: '${schemaPath}',
        out: '${migrationsPath}',
        dbCredentials: { url: '${dbUrl}' },
      });
    `,
    );

    // Step 3: spawn drizzle-kit generate
    execSync(`npm run generate:sql -- --config=${configPath} --verbose`, {
      stdio: 'inherit',
    });
  } catch (error: unknown) {
    console.log('Migrationed failed to run: ', error);
    throw error;
  } finally {
    // cleanup
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, {recursive: true, force: true});
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError);
      }
    }
  }
}

const migrateDatabase = async (config: AppConfig) => {
  const engine = config.database.engine;
  const models = config.models;

  await generateMigrationSQL(
    models,
    engine,
    config.database.connection.urlOrPath,
  );
};

export default migrateDatabase;
