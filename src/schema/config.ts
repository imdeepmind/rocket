export type DBEngine = 'sqlite' | 'pg';
export type DataType = 'integer' | 'string' | 'boolean' | 'text' | 'datetime';
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent';
export type ForeignKeyAction =
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'RESTRICT'
  | 'NO ACTION';
export type SupportedOperations =
  | 'searchable'
  | 'sortable'
  | 'editable'
  | 'deletable'
  | 'lessThan'
  | 'lessThanEqual'
  | 'greaterThan'
  | 'greaterThanEqual'
  | 'equal'
  | 'oneOf'
  | 'indexable';
export type SupportedAggregationOperation =
  | 'mean'
  | 'max'
  | 'min'
  | 'count'
  | 'sum'
  | 'frequency';
export type ModelBody = Record<
  string,
  string | number | boolean | null | undefined
>;
export type JsonSchemaProperty = {
  type?: string;
  [key: string]: unknown;
};

export type JsonSchemaObject = {
  properties?: Record<string, JsonSchemaProperty> | null;
  required?: string[];
  [key: string]: unknown;
};

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
  dbTimeout?: number;
}

export interface ModelFieldConfig {
  name: string;
  type: DataType;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  supportedOperations?: SupportedOperations[];
  supportedAggregation?: SupportedAggregationOperation[];
}

export interface ModelIndexConfig {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ModelForeignKeyConfig {
  name: string;
  columns: string[];
  referenceTable: string;
  referenceColumns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface ModelConfig {
  name: string;
  fields: ModelFieldConfig[];
  indexes?: ModelIndexConfig[];
  foreignKeys?: ModelForeignKeyConfig[];
  validation?: Record<string, unknown>;
}

export interface ApplicationConfig {
  logLevel: LogLevel;
}

export interface AppConfig {
  application: ApplicationConfig;
  swagger: SwaggerConfig;
  database: DatabaseConfig;
  models: ModelConfig[];
}
