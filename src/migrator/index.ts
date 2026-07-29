import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {AppConfig, DBEngine, ModelConfig} from '@/interfaces/config';

function injectTimestamps(model: ModelConfig, engine: DBEngine): void {
  if (!model.timestamps) return;

  const nowDefault =
    engine === 'sqlite' ? {raw: "(datetime('now'))"} : {raw: 'now()'};

  if (!('created_at' in model.fields)) {
    model.fields.created_at = {
      type: 'datetime',
      nullable: false,
      default: nowDefault,
    };
  }

  if (!('updated_at' in model.fields)) {
    model.fields.updated_at = {
      type: 'datetime',
      nullable: false,
      default: nowDefault,
    };
  }
}

function generateRelations(
  modelName: string,
  relations: NonNullable<ModelConfig['relations']>,
): string {
  return Object.entries(relations)
    .map(([relationName, rel]) => {
      let fkDef = `    foreignKey({ name: '${relationName}', columns: [t.${rel.localField}], foreignColumns: [${rel.model}.${rel.foreignField}] })`;
      if (rel.onDelete) {
        fkDef += `.onDelete('${rel.onDelete}')`;
      }
      if (rel.onUpdate) {
        fkDef += `.onUpdate('${rel.onUpdate}')`;
      }
      return fkDef;
    })
    .join(',\n');
}

function generateSchemaFile(
  modelName: string,
  config: ModelConfig,
  engine: DBEngine,
): string {
  // inject timestamps into the model config in-memory
  injectTimestamps(config, engine);

  const columns = Object.entries(config.fields)
    .map(([fName, f]) => {
      let col = '';
      if (engine === 'sqlite') {
        switch (f.type) {
          case 'integer':
          case 'boolean':
            col = `integer('${fName}')`;
            break;
          case 'string':
          case 'text':
            col = `text('${fName}')`;
            break;
          case 'datetime':
            col = `integer('${fName}', { mode: 'timestamp' })`;
            break;
          case 'decimal':
            col = `real('${fName}')`;
            break;
          case 'date':
            col = `text('${fName}')`;
            break;
          case 'json':
            col = `text('${fName}', { mode: 'json' })`;
            break;
          case 'enum':
            col = `text('${fName}', { enum: [${(f.values as string[]).map(v => JSON.stringify(v)).join(', ')}] })`;
            break;
          case 'uuid':
          case 'ulid':
            col = `text('${fName}')`;
            break;
          default:
            col = `text('${fName}')`;
            break;
        }
        if (f.primaryKey) {
          if (f.autoIncrement) {
            col += '.primaryKey({ autoIncrement: true })';
          } else {
            col += '.primaryKey()';
          }
        }
        if (f.unique && !f.primaryKey) col += '.unique()';
        if (f.nullable === false) col += '.notNull()';
        if (f.default !== undefined) {
          const def = f.default as Record<string, unknown>;
          if (def && typeof def === 'object' && 'raw' in def) {
            col += `.default(sql\`${def.raw}\`)`;
          } else {
            col += `.default(${JSON.stringify(f.default)})`;
          }
        }
      } else {
        switch (f.type) {
          case 'integer':
            col = f.primaryKey ? `serial('${fName}')` : `integer('${fName}')`;
            break;
          case 'string':
          case 'text':
            col = `text('${fName}')`;
            break;
          case 'boolean':
            col = `boolean('${fName}')`;
            break;
          case 'datetime':
            col = `timestamp('${fName}')`;
            break;
          case 'decimal':
            col = `doublePrecision('${fName}')`;
            break;
          case 'date':
            col = `date('${fName}')`;
            break;
          case 'json':
            col = `jsonb('${fName}')`;
            break;
          case 'enum':
            col = `${modelName}_${fName}_enum('${fName}')`;
            break;
          case 'uuid':
            col = `uuid('${fName}')`;
            break;
          case 'ulid':
            col = `text('${fName}')`;
            break;
          default:
            col = `text('${fName}')`;
            break;
        }
        if (f.primaryKey) {
          if (f.autoIncrement) {
            col += '.primaryKey()';
            // serial already implies auto-increment in PG
          } else {
            col += '.primaryKey()';
          }
        }
        if (f.unique && !f.primaryKey) col += '.unique()';
        if (f.nullable === false) col += '.notNull()';
        if (f.default !== undefined) {
          const def = f.default as Record<string, unknown>;
          if (def && typeof def === 'object' && 'raw' in def) {
            col += `.default(sql\`${def.raw}\`)`;
          } else {
            col += `.default(${JSON.stringify(f.default)})`;
          }
        }
      }
      return `    ${fName}: ${col}`;
    })
    .join(',\n');

  const indexes = Object.entries(config.indexes ?? {})
    .map(([idxName, idx]) => {
      const cols = idx.fields.map(c => `t.${c}`).join(', ');
      return idx.unique
        ? `    uniqueIndex('${idxName}').on(${cols})`
        : `    index('${idxName}').on(${cols})`;
    })
    .join(',\n');

  const relations =
    config.relations && Object.keys(config.relations).length > 0
      ? generateRelations(modelName, config.relations)
      : '';

  const extras = [indexes, relations].filter(Boolean).join(',\n');

  const enumFields = Object.entries(config.fields).filter(
    ([, f]) => f.type === 'enum' && f.values && f.values.length > 0,
  );

  const pgEnumDeclarations =
    engine === 'postgres' && enumFields.length > 0
      ? enumFields
          .map(
            ([fName, f]) =>
              `export const ${modelName}_${fName}_enum = pgEnum('${modelName}_${fName}_enum', [${(f.values as string[]).map(v => JSON.stringify(v)).join(', ')}]);`,
          )
          .join('\n') + '\n'
      : '';

  if (engine === 'sqlite') {
    return `
import { sqliteTable, integer, text, real, index, uniqueIndex, foreignKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const ${modelName} = sqliteTable('${modelName}', {
${columns}
}${extras ? `, (t) => [\n${extras}\n]` : ''});
`.trim();
  } else {
    return `
import { pgTable, serial, integer, text, boolean, doublePrecision, index, uniqueIndex, timestamp, date, foreignKey, jsonb, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

${pgEnumDeclarations}export const ${modelName} = pgTable('${modelName}', {
${columns}
}${extras ? `, (t) => [\n${extras}\n]` : ''});
`.trim();
  }
}

async function generateMigrationSQL(
  configs: Array<{name: string; model: ModelConfig}>,
  engine: DBEngine,
  dbUrl: string,
): Promise<void> {
  let tmpDir: string | undefined;

  try {
    const testDataPath = path.join(process.cwd(), '.migrations');
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, {recursive: true});
    }

    tmpDir = fs.mkdtempSync(path.join(testDataPath, 'drizzle-'));
    const schemaPath = path.join(tmpDir, 'schema.ts');
    const migrationsPath = path.join(tmpDir, 'migrations');
    const configPath = path.join(tmpDir, 'drizzle.config.ts');

    const schemas = [];

    for (const {name, model} of configs) {
      schemas.push(generateSchemaFile(name, model, engine));
    }

    // write schema.ts
    fs.writeFileSync(schemaPath, schemas.join('\n'));

    // write drizzle.config.ts
    fs.writeFileSync(
      configPath,
      `
      import { defineConfig } from 'drizzle-kit';
      export default defineConfig({
        dialect: '${engine === 'postgres' ? 'postgresql' : 'sqlite'}',
        schema: '${schemaPath}',
        out: '${migrationsPath}',
        dbCredentials: { url: process.env.DRIZZLE_DATABASE_URL! },
      });
    `,
    );

    // Step 3: spawn drizzle-kit generate
    execSync(`npm run generate:sql -- --config=${configPath} --verbose`, {
      stdio: 'inherit',
      env: {...process.env, DRIZZLE_DATABASE_URL: dbUrl},
    });
  } catch (error: unknown) {
    console.log('Migration failed to run: ', error);
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
  const engine = config.infrastructure.database.engine;
  const models = Object.entries(config.data.models).map(([name, model]) => ({
    name,
    model,
  }));

  await generateMigrationSQL(
    models,
    engine,
    config.infrastructure.database.connection.url,
  );
};

export default migrateDatabase;
