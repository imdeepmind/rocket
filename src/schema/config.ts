import {HTTPMethod} from './index';

export type DBEngine = 'sqlite' | 'pg';
export type CacheDbEngine = 'redis';
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
export type WebhookData = 'query' | 'body' | 'params' | 'resp';
export type AuthEngine = 'api-key' | 'up-auth';

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

export interface CacheDbConfig {
  engine: CacheDbEngine;
  connection: {
    uri: string;
  };
  timeout?: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: string;
  useRedis: boolean;
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
  rateLimit?: RateLimitConfig;
}

export interface WebhookConfig {
  url: string;
  data: WebhookData[];
  triggerOnRequest: boolean;
  triggerOnResponse: boolean;
}

export interface CustomQueryConfig {
  method: HTTPMethod;
  path: string;
  query: string;
  webhooks?: WebhookConfig[];
}

export interface ModelAPIConfig {
  aggregate?: {
    webhooks?: WebhookConfig[];
  };
  delete?: {
    webhooks?: WebhookConfig[];
  };
  edit?: {
    webhooks?: WebhookConfig[];
  };
  ['get-all']?: {
    webhooks?: WebhookConfig[];
  };
  index?: {
    webhooks?: WebhookConfig[];
  };
  post?: {
    webhooks?: WebhookConfig[];
  };
  search?: {
    webhooks?: WebhookConfig[];
  };
}

export interface ApisConfig {
  customQueries?: CustomQueryConfig[];
  modelAPIs?: Record<string, ModelAPIConfig>;
}

export interface AuthConfig {
  enableAuth: boolean;
  authEngine: AuthEngine;
  authModel: {
    modelName: string;
    idColumn: string;
    usernameColumn: string;
    passwordColumn: string;
  };
  apiKey?: string;
}

export interface AppConfig {
  application: ApplicationConfig;
  swagger: SwaggerConfig;
  database: DatabaseConfig;
  models: ModelConfig[];
  apis?: ApisConfig;
  cache_db?: CacheDbConfig;
  auth?: AuthConfig;
}
