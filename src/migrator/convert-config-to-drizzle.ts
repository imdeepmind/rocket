import { DBEngine, ModelConfig, ModelFieldConfig } from '../schema/config';

import {
  pgTable,
  integer as pgInteger,
  text as pgText,
  boolean as pgBoolean,
  timestamp as pgTimestamp,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
  AnyPgColumn,
  foreignKey as pgForeignKey,
} from 'drizzle-orm/pg-core';

import {
  sqliteTable,
  integer as sqliteInteger,
  text as sqliteText,
  index as sqliteIndex,
  uniqueIndex as sqliteUniqueIndex,
  AnySQLiteColumn,
  foreignKey as sqliteForeignKey,
} from 'drizzle-orm/sqlite-core';

interface ColumnBuilder {
  primaryKey: () => ColumnBuilder;
  unique: () => ColumnBuilder;
  default: (val: unknown) => ColumnBuilder;
  notNull: () => ColumnBuilder;
}

function buildColumnPg(field: ModelFieldConfig) {
  let col: ColumnBuilder;

  switch (field.type) {
    case 'integer':
      col = pgInteger(field.name) as unknown as ColumnBuilder;
      break;
    case 'string':
      col = pgText(field.name) as unknown as ColumnBuilder;
      break;
    case 'text':
      col = pgText(field.name) as unknown as ColumnBuilder;
      break;
    case 'boolean':
      col = pgBoolean(field.name) as unknown as ColumnBuilder;
      break;
    case 'datetime':
      col = pgTimestamp(field.name) as unknown as ColumnBuilder;
      break;
    default:
      throw new Error(`Unsupported type: ${field.type}`);
  }

  if (field.primaryKey) col = col.primaryKey();
  if (field.unique) col = col.unique();
  if (field.default !== undefined) col = col.default(field.default);
  // nullable is the default in drizzle, notNull() is the opt-in
  if (field.nullable === false) col = col.notNull();

  return col;
}

function jsonConfigToDrizzleSchemaPg(config: ModelConfig[]) {
  const drizzleSchema: Record<string, unknown> = {};
  for (const model of config) {
    const columns = Object.fromEntries(
      model.fields.map((f) => [f.name, buildColumnPg(f)])
    ) as Record<string, ReturnType<typeof pgInteger>>;

    const table = pgTable(model.name, columns, (t) => {
      const idxs = (model.indexes ?? []).map((idx) => {
        const cols = idx.columns.map((c) => t[c] as AnyPgColumn) as [AnyPgColumn, ...AnyPgColumn[]];
        return idx.unique ? pgUniqueIndex(idx.name).on(...cols) : pgIndex(idx.name).on(...cols);
      });

      const fks = (model.foreignKeys ?? []).map((fk) => {
        const cols = fk.columns.map((c) => t[c] as AnyPgColumn);
        const refTable = drizzleSchema[fk.referenceTable] as Record<string, AnyPgColumn>;
        const fgCols = fk.referenceColumns.map((c) => refTable[c] as AnyPgColumn);

        let fkDef = pgForeignKey({
          name: fk.name,
          columns: cols as [AnyPgColumn, ...AnyPgColumn[]],
          foreignColumns: fgCols as [AnyPgColumn, ...AnyPgColumn[]],
        });

        type FKAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default';
        if (fk.onDelete) fkDef = fkDef.onDelete(fk.onDelete.toLowerCase() as FKAction);
        if (fk.onUpdate) fkDef = fkDef.onUpdate(fk.onUpdate.toLowerCase() as FKAction);
        return fkDef;
      });

      return [...idxs, ...fks];
    });

    drizzleSchema[model.name] = table;
  }

  return drizzleSchema;
}

function buildColumnSqlite(field: ModelFieldConfig) {
  let col: ColumnBuilder;

  switch (field.type) {
    case 'integer':
      col = sqliteInteger(field.name) as unknown as ColumnBuilder;
      break;
    case 'string':
      col = sqliteText(field.name) as unknown as ColumnBuilder;
      break;
    case 'text':
      col = sqliteText(field.name) as unknown as ColumnBuilder;
      break;
    case 'boolean':
      col = sqliteInteger(field.name, { mode: 'boolean' }) as unknown as ColumnBuilder;
      break;
    case 'datetime':
      col = sqliteInteger(field.name, { mode: 'timestamp' }) as unknown as ColumnBuilder;
      break;
    default:
      throw new Error(`Unsupported type: ${field.type}`);
  }

  if (field.primaryKey) col = col.primaryKey();
  if (field.unique) col = col.unique();
  if (field.default !== undefined) col = col.default(field.default);
  // nullable is the default in drizzle, notNull() is the opt-in
  if (field.nullable === false) col = col.notNull();

  return col;
}

function jsonConfigToDrizzleSchemaSqlite(config: ModelConfig[]) {
  const drizzleSchema: Record<string, unknown> = {};
  for (const model of config) {
    const columns = Object.fromEntries(
      model.fields.map((f) => [f.name, buildColumnSqlite(f)])
    ) as Record<string, ReturnType<typeof sqliteInteger>>;

    const table = sqliteTable(model.name, columns, (t) => {
      const idxs = (model.indexes ?? []).map((idx) => {
        const cols = idx.columns.map((c) => t[c] as AnySQLiteColumn) as [
          AnySQLiteColumn,
          ...AnySQLiteColumn[],
        ];
        return idx.unique
          ? sqliteUniqueIndex(idx.name).on(...cols)
          : sqliteIndex(idx.name).on(...cols);
      });

      const fks = (model.foreignKeys ?? []).map((fk) => {
        const cols = fk.columns.map((c) => t[c] as AnySQLiteColumn);
        const refTable = drizzleSchema[fk.referenceTable] as Record<string, AnySQLiteColumn>;
        const fgCols = fk.referenceColumns.map((c) => refTable[c] as AnySQLiteColumn);

        let fkDef = sqliteForeignKey({
          name: fk.name,
          columns: cols as [AnySQLiteColumn, ...AnySQLiteColumn[]],
          foreignColumns: fgCols as [AnySQLiteColumn, ...AnySQLiteColumn[]],
        });

        type FKAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default';
        if (fk.onDelete) fkDef = fkDef.onDelete(fk.onDelete.toLowerCase() as FKAction);
        if (fk.onUpdate) fkDef = fkDef.onUpdate(fk.onUpdate.toLowerCase() as FKAction);
        return fkDef;
      });

      return [...idxs, ...fks];
    });

    drizzleSchema[model.name] = table;
  }

  return drizzleSchema;
}

const convertConfigToDrizzle = (engine: DBEngine, config: ModelConfig[]) => {
  if (engine === 'sqlite') return jsonConfigToDrizzleSchemaSqlite(config);

  return jsonConfigToDrizzleSchemaPg(config);
};

export default convertConfigToDrizzle;
