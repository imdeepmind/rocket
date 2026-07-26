import {HTTPMethod} from './index';

export type DBEngine = 'sqlite' | 'postgres';
export type CacheDbEngine = 'redis';
export type DataType =
  | 'integer'
  | 'string'
  | 'boolean'
  | 'text'
  | 'datetime'
  | 'decimal'
  | 'date';
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent';
export type ApiOperation = 'search' | 'index' | 'edit' | 'delete';
export type QueryOperation =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'not_in'
  | 'sort';
export type Aggregation = 'count' | 'avg' | 'sum' | 'min' | 'max' | 'frequency';
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
export type WebhookData = 'query' | 'body' | 'params' | 'response';
export type AuthProviderType = 'api-key' | 'up-auth';
export type ServerParamType = 'path' | 'query' | 'body';
export type EmailEngine = 'dummy';
export type RelationType = 'belongsTo';
export type ForeignKeyAction =
  | 'cascade'
  | 'set null'
  | 'set default'
  | 'restrict'
  | 'no action';

export interface DocsConfig {
  openapi: {
    enabled: boolean;
    path: string;
    info: {
      title: string;
      description?: string;
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
  };
}

export interface DatabaseConfig {
  engine: DBEngine;
  connection: {
    url: string;
  };
  timeout?: number;
}

export interface CacheDbConfig {
  engine: CacheDbEngine;
  connection: {
    url: string;
  };
  timeout?: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: string;
}

export interface ModelFieldConfig {
  type: DataType;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  apis?: ApiOperation[];
  query?: QueryOperation[];
  aggregations?: Aggregation[];
}

export interface ModelIndexConfig {
  fields: string[];
  unique?: boolean;
}

export interface ModelRelationConfig {
  type: RelationType;
  model: string;
  localField: string;
  foreignField: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface ModelConfig {
  timestamps?: boolean;
  validation?: Record<string, unknown>;
  fields: Record<string, ModelFieldConfig>;
  indexes?: Record<string, ModelIndexConfig>;
  relations?: Record<string, ModelRelationConfig>;
}

export interface DataConfig {
  models: Record<string, ModelConfig>;
}

export interface ApplicationConfig {
  name: string;
  logLevel: LogLevel;
  rateLimit?: RateLimitConfig;
}

export interface WebhookConfig {
  url: string;
  data: WebhookData[];
  triggerOnRequest: boolean;
  triggerOnResponse: boolean;
}

export interface CustomEndpointHandler {
  type: string;
  sql: string;
}

export interface CustomEndpointConfig {
  method: HTTPMethod;
  path: string;
  description: string;
  validation?: Record<string, unknown>;
  handler: CustomEndpointHandler;
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

export interface ServerParamConfig {
  type: ServerParamType;
  name: string;
  value: number | string | boolean;
}

export interface ApisConfig {
  [key: string]: {
    enabled?: boolean;
    webhooks?: WebhookConfig[];
    serverParams?: ServerParamConfig[];
    authorization?: boolean;
  };
}

export interface UserModelConfig {
  model: string;
  idField: string;
  usernameField: string;
  passwordField: string;
  isVerifiedField?: string;
}

export interface UpAuthProviderConfig {
  userModel: UserModelConfig;
  jwtSecret?: string;
  tokenExpiration?: string;
  mfaRequired?: boolean;
}

export interface ApiKeyProviderConfig {
  key: string;
}

export interface UpAuthProvider {
  type: 'up-auth';
  config: UpAuthProviderConfig;
}

export interface ApiKeyProvider {
  type: 'api-key';
  config: ApiKeyProviderConfig;
}

export type AuthProvider = UpAuthProvider | ApiKeyProvider;

export interface AuthenticationConfig {
  enabled: boolean;
  provider: AuthProvider;
}

export interface EmailConfig {
  provider: EmailEngine;
}

export interface IntegrationsConfig {
  email?: EmailConfig;
}

export interface InfrastructureConfig {
  database: DatabaseConfig;
  cache?: CacheDbConfig;
}

export interface AppConfig {
  application: ApplicationConfig;
  docs: DocsConfig;
  infrastructure: InfrastructureConfig;
  data: DataConfig;
  apis?: ApisConfig;
  customEndpoints?: Record<string, CustomEndpointConfig>;
  authentication?: AuthenticationConfig;
  integrations?: IntegrationsConfig;
}
