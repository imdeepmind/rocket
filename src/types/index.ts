export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type DBEngine = 'sqlite' | 'pg';
export type DataType = 'integer' | 'string' | 'boolean' | 'text' | 'datetime';
export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

export interface SwaggerConfig {
  enabled: boolean;
  basePath: string;
  info: {
    title: string;
    description: string;
    version: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
}

export interface DatabaseConfig {
  engine: DBEngine;
  connection: {
    urlOrPath: string;
  };
}

export interface DatabaseQuery {
  query<T, Q>(sql: string, params?: T[]): Promise<Q[]>;
  close: () => Promise<void>;
}

export interface ModelField {
  name: string;
  type: DataType;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
}

export interface ModelIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ModelForeignKey {
  name: string;
  columns: string[];
  referenceTable: string;
  referenceColumns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface ModelConfig {
  name: string;
  fields: ModelField[];
  indexes?: ModelIndex[];
  foreignKeys?: ModelForeignKey[];
}

export interface AppConfig {
  swagger: SwaggerConfig;
  database: DatabaseConfig;
  models: ModelConfig[];
}
