import {HTTPMethod} from './index';

export type DBEngine = 'sqlite' | 'postgres';
export type CacheDbEngine = 'redis' | 'memory';
export type DataType =
  | 'integer'
  | 'string'
  | 'boolean'
  | 'text'
  | 'datetime'
  | 'decimal'
  | 'date'
  | 'json'
  | 'enum'
  | 'uuid'
  | 'ulid';
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
export type ServerSideParamType = 'path' | 'query' | 'body';
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
  connection?: {
    url: string;
  };
  timeout?: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: string;
}

export interface CorsConfig {
  enabled: boolean;
  origins?: string[];
  methods?: (HTTPMethod | 'HEAD')[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  routes?: string[];
}

export interface ModelFieldConfig {
  type: DataType;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  secret?: boolean;
  apis?: ApiOperation[];
  query?: QueryOperation[];
  aggregations?: Aggregation[];
  values?: string[];
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

export interface HealthCheckConfig {
  enabled?: boolean;
  path?: string;
}

export interface ApplicationConfig {
  name: string;
  logLevel: LogLevel;
  rateLimit?: RateLimitConfig;
  cors?: CorsConfig;
  dangerouslyOverrideDefaultVariant?: string;
  magicVariables?: Record<string, string | number | boolean>;
  healthCheck?: HealthCheckConfig;
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

export interface ServerSideParamConfig {
  type: ServerSideParamType;
  name: string;
  value: number | string | boolean;
}

export interface ApisConfig {
  [key: string]: {
    enabled?: boolean;
    tags?: string[];
    webhooks?: WebhookConfig[];
    serverSideParams?: ServerSideParamConfig[];
    authorization?: boolean;
    bypassSecret?: boolean;
    supportedAggregations?: Aggregation[];
    supportedQueries?: QueryOperation[];
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
  provider?: AuthProvider;
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

export interface ApiVariantEntry {
  variants: string[];
}

export type DocsInfoConfig = DocsConfig['openapi']['info'];

/**
 * Sparse, user-facing configuration. Every operational section is optional;
 * `resolveConfig` is responsible for turning it into a `ResolvedAppConfig`.
 */
export interface ApplicationConfigInput extends Omit<
  Partial<ApplicationConfig>,
  'rateLimit' | 'cors'
> {
  rateLimit?: Partial<RateLimitConfig>;
  cors?: Partial<CorsConfig>;
}

export interface DocsConfigInput extends Omit<Partial<DocsConfig>, 'openapi'> {
  openapi?: Omit<Partial<DocsConfig['openapi']>, 'info'> & {
    info?: Partial<DocsInfoConfig>;
  };
}

export interface InfrastructureConfigInput {
  database?: DatabaseConfig;
  cache?: CacheDbConfig;
}

export interface ModelConfigInput extends Omit<
  ModelConfig,
  'indexes' | 'relations'
> {
  indexes?: Record<string, ModelIndexConfig>;
  relations?: Record<string, ModelRelationConfig>;
}

export interface DataConfigInput {
  models?: Record<string, ModelConfigInput>;
}

export interface AuthenticationConfigInput {
  enabled?: boolean;
  provider?: AuthProvider;
}

export interface AppConfigInput {
  application?: ApplicationConfigInput;
  docs?: DocsConfigInput;
  infrastructure?: InfrastructureConfigInput;
  data?: DataConfigInput;
  apis?: ApisConfig;
  customEndpoints?: Record<string, CustomEndpointConfig>;
  authentication?: AuthenticationConfigInput;
  integrations?: IntegrationsConfig;
  apiVariants?: Record<string, ApiVariantEntry>;
}

export interface ResolvedCorsConfig {
  enabled: boolean;
  origins: string[];
  methods: (HTTPMethod | 'HEAD')[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  routes: string[];
}

/**
 * Dense, consumer-facing configuration produced by `resolveConfig`.
 */
export interface ResolvedApplicationConfig {
  name: string;
  logLevel: LogLevel;
  rateLimit: RateLimitConfig;
  cors: ResolvedCorsConfig;
  dangerouslyOverrideDefaultVariant: string;
  magicVariables: Record<string, string | number | boolean>;
  healthCheck: {
    enabled: boolean;
    path: string;
  };
}

export interface ResolvedDocsConfig {
  openapi: {
    enabled: boolean;
    path: string;
    info: DocsInfoConfig;
  };
}

export interface ResolvedDatabaseConfig {
  engine: DBEngine;
  connection: {
    url: string;
  };
  timeout: number;
}

export type ResolvedCacheConfig =
  | {engine: 'memory'}
  | {
      engine: 'redis';
      connection: {
        url: string;
      };
      timeout: number;
    };

export interface ResolvedInfrastructureConfig {
  database: ResolvedDatabaseConfig;
  cache: ResolvedCacheConfig;
}

export interface ResolvedModelFieldConfig {
  type: DataType;
  primaryKey: boolean;
  autoIncrement: boolean;
  nullable: boolean;
  unique: boolean;
  secret: boolean;
  apis: ApiOperation[];
  query: QueryOperation[];
  aggregations: Aggregation[];
  default?: unknown;
  values?: string[];
}

export interface ResolvedModelIndexConfig {
  fields: string[];
  unique: boolean;
}

export interface ResolvedModelRelationConfig {
  type: RelationType;
  model: string;
  localField: string;
  foreignField: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface ResolvedModelConfig {
  timestamps: boolean;
  validation?: Record<string, unknown>;
  fields: Record<string, ResolvedModelFieldConfig>;
  indexes: Record<string, ResolvedModelIndexConfig>;
  relations: Record<string, ResolvedModelRelationConfig>;
}

export interface ResolvedDataConfig {
  models: Record<string, ResolvedModelConfig>;
}

export interface ResolvedUpAuthProviderConfig {
  userModel: UserModelConfig;
  jwtSecret: string;
  tokenExpiration: string;
  mfaRequired: boolean;
}

export interface ResolvedUpAuthProvider {
  type: 'up-auth';
  config: ResolvedUpAuthProviderConfig;
}

export interface ResolvedApiKeyProvider {
  type: 'api-key';
  config: ApiKeyProviderConfig;
}

export type ResolvedAuthProvider =
  | ResolvedUpAuthProvider
  | ResolvedApiKeyProvider;

export type ResolvedAuthenticationConfig =
  | {enabled: false}
  | {enabled: true; provider: ResolvedAuthProvider};

export interface ResolvedAppConfig {
  application: ResolvedApplicationConfig;
  docs: ResolvedDocsConfig;
  infrastructure: ResolvedInfrastructureConfig;
  data: ResolvedDataConfig;
  apis: ApisConfig;
  customEndpoints: Record<string, CustomEndpointConfig>;
  authentication: ResolvedAuthenticationConfig;
  integrations: IntegrationsConfig;
  apiVariants: Record<string, ApiVariantEntry>;
}

/**
 * Dense configuration with required operational sections. Kept as the
 * compatibility type for code that has not migrated to `ResolvedAppConfig`.
 */
export interface AppConfig extends Omit<
  AppConfigInput,
  'application' | 'docs' | 'infrastructure' | 'data' | 'authentication'
> {
  application: ApplicationConfig;
  docs: DocsConfig;
  infrastructure: InfrastructureConfig;
  data: DataConfig;
  authentication?: AuthenticationConfig;
}
