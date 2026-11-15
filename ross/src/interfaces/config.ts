import {HTTPMethod, Mode} from './index';

export type DBEngine = 'sqlite' | 'postgres' | 'mysql';
export type CacheDbEngine = 'redis' | 'memory' | 'memcached';
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
export type EmailEngine = 'dummy' | 'aws-ses' | 'sendgrid';
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

export interface DatabaseMigrationsConfig {
  directory: string;
  dangerouslyAllowDDL?: boolean;
}

export interface ResolvedDatabaseMigrationsConfig {
  directory: string;
  dangerouslyAllowDDL: boolean;
}

export interface DatabaseConfig {
  engine: DBEngine;
  connection: {
    url: string;
  };
  timeout?: number;
  migrations?: DatabaseMigrationsConfig;
}

export type DatabaseConfigInput = DatabaseConfig;

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
  rateLimitHealthAPI?: boolean;
}

export interface ResolvedRateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: string;
  rateLimitHealthAPI: boolean;
}

export interface CorsConfig {
  enabled: boolean;
  origins?: string[];
  methods?: (HTTPMethod | 'HEAD' | 'OPTIONS')[];
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

export interface CustomEndpointSqlHandler {
  type: 'sql';
  sql: string;
}

export interface CustomEndpointFunctionInputs {
  path?: string[];
  query?: string[];
  body?: string[];
  headers?: string[];
  header?: string[];
}

export interface CustomEndpointFunctionHandler {
  type: 'function';
  file: string;
  exportName: string;
  inputs?: CustomEndpointFunctionInputs;
}

export type CustomEndpointHandler =
  | CustomEndpointSqlHandler
  | CustomEndpointFunctionHandler;

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
    roles?: string[];
    bypassSecret?: boolean;
    supportedAggregations?: Aggregation[];
    supportedQueries?: QueryOperation[];
  };
}

export type AuthProtocol = 'oauth2' | 'oidc' | 'saml';

/**
 * What an authentication provider can do. The HTTP surface is derived from
 * these flags so that password-only providers never expose SSO endpoints and
 * vice versa.
 */
export type AuthCapability =
  | 'password'
  | 'register'
  | 'mfa'
  | 'initiate'
  | 'callback'
  | 'metadata'
  | 'token-exchange';

/**
 * User-table columns shared by every provider type. All providers read and
 * write the same table, so these live once at `authentication.userModel`.
 */
export interface AuthUserModelConfig {
  modelName: string;
  idField: string;
  providerField: string;
}

export interface UpAuthFieldsConfig {
  usernameField: string;
  passwordField: string;
  isVerifiedField?: string;
}

export interface UpAuthConfigInput {
  fields: UpAuthFieldsConfig;
  mfaRequired?: boolean;
}

export interface SsoBaseConfigInput {
  fields: {
    providerIdField: string;
  };
  attributeMapping?: Record<string, string>;
  scopes?: string[];
  /** Absolute URL registered at the identity provider. Derived when absent. */
  callbackUrl?: string;
  /** Where to send the browser on success. JSON is returned when absent. */
  redirectUrl?: string;
  /** Defaults to `redirectUrl`. Ignored when `redirectUrl` is absent. */
  failureRedirectUrl?: string;
}

export interface OAuth2ConfigInput extends SsoBaseConfigInput {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  /** Claim holding the stable subject. Defaults to `sub`, `id`, `user_id`. */
  idClaim?: string;
  clientId: string;
  clientSecret: string;
}

export interface OidcConfigInput extends SsoBaseConfigInput {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface SamlConfigInput extends SsoBaseConfigInput {
  entryPoint: string;
  issuer: string;
  cert: string;
}

export interface ApiKeyProviderConfig {
  key: string;
}

export type AuthProviderInput =
  | {type: 'up-auth'; config: UpAuthConfigInput}
  | {type: 'api-key'; config: ApiKeyProviderConfig}
  | {type: 'sso'; name: string; protocol: 'oauth2'; config: OAuth2ConfigInput}
  | {type: 'sso'; name: string; protocol: 'oidc'; config: OidcConfigInput}
  | {type: 'sso'; name: string; protocol: 'saml'; config: SamlConfigInput};

/** Convenience aliases kept for readability at call sites. */
export type AuthProvider = AuthProviderInput;

export interface AuthenticationConfigInput {
  enabled?: boolean;
  jwtSecret?: string;
  tokenExpiration?: string;
  userModel?: AuthUserModelConfig;
  providers?: AuthProviderInput[];
}

export type AuthenticationConfig = AuthenticationConfigInput;

export interface RoleConfig {
  description?: string;
  includes?: string[];
}

export interface RbacConfig {
  enabled: boolean;
  modelName?: string;
  roleField?: string;
  defaultRole?: string;
  roles?: Record<string, RoleConfig>;
}

export interface AwsSesEmailOptions {
  region: string;
  fromEmail: string;
  /**
   * Optional explicit credentials. When both are omitted, the AWS SDK default
   * credential chain is used (env vars, shared profile, ECS/Lambda/EC2 roles).
   */
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface SendgridEmailOptions {
  apiKey: string;
  fromEmail: string;
}

export interface DummyEmailConfig {
  provider: 'dummy';
}

export interface AwsSesEmailConfig {
  provider: 'aws-ses';
  config: AwsSesEmailOptions;
}

export interface SendgridEmailConfig {
  provider: 'sendgrid';
  config: SendgridEmailOptions;
}

export type EmailConfig =
  | DummyEmailConfig
  | AwsSesEmailConfig
  | SendgridEmailConfig;

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
  rbac?: RbacConfig;
}

export interface DefineConfigOptions {
  /** Configuration mode. Defaults to `prod` when NODE_ENV is `production`. */
  mode?: Mode;
  /** Base directory for relative paths such as custom functions/migrations. */
  configDir?: string;
}

export interface ResolvedCorsConfig {
  enabled: boolean;
  origins: string[];
  methods: (HTTPMethod | 'HEAD' | 'OPTIONS')[];
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
  rateLimit: ResolvedRateLimitConfig;
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
  migrations?: ResolvedDatabaseMigrationsConfig;
}

export type ResolvedCacheConfig =
  | {engine: 'memory'}
  | {
      engine: 'redis';
      connection: {
        url: string;
      };
      timeout: number;
    }
  | {
      engine: 'memcached';
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

export interface ResolvedUpAuthConfig {
  fields: UpAuthFieldsConfig;
  mfaRequired: boolean;
}

export interface ResolvedUpAuthProvider {
  type: 'up-auth';
  config: ResolvedUpAuthConfig;
}

export interface ResolvedApiKeyProvider {
  type: 'api-key';
  config: ApiKeyProviderConfig;
}

interface ResolvedSsoBase {
  fields: {
    providerIdField: string;
  };
  attributeMapping: Record<string, string>;
  scopes: string[];
  callbackUrl?: string;
  redirectUrl?: string;
  failureRedirectUrl?: string;
}

export interface ResolvedOAuth2SsoProvider {
  type: 'sso';
  name: string;
  protocol: 'oauth2';
  config: ResolvedSsoBase & {
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl?: string;
    idClaim?: string;
    clientId: string;
    clientSecret: string;
  };
}

export interface ResolvedOidcSsoProvider {
  type: 'sso';
  name: string;
  protocol: 'oidc';
  config: ResolvedSsoBase & {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
  };
}

export interface ResolvedSamlSsoProvider {
  type: 'sso';
  name: string;
  protocol: 'saml';
  config: ResolvedSsoBase & {
    entryPoint: string;
    issuer: string;
    cert: string;
  };
}

export type ResolvedSsoProvider =
  | ResolvedOAuth2SsoProvider
  | ResolvedOidcSsoProvider
  | ResolvedSamlSsoProvider;

export type ResolvedAuthProvider =
  | ResolvedUpAuthProvider
  | ResolvedApiKeyProvider
  | ResolvedSsoProvider;

export type ResolvedAuthenticationConfig =
  | {enabled: false}
  | {
      enabled: true;
      jwtSecret?: string;
      tokenExpiration: string;
      userModel?: AuthUserModelConfig;
      providers: ResolvedAuthProvider[];
    };

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
  rbac: RbacConfig;
}

/**
 * Dense configuration with required operational sections. Kept as the
 * compatibility type for code that has not migrated to `ResolvedAppConfig`.
 */
export interface AppConfig extends Omit<
  AppConfigInput,
  'application' | 'docs' | 'infrastructure' | 'data' | 'authentication' | 'rbac'
> {
  application: ApplicationConfig;
  docs: DocsConfig;
  infrastructure: InfrastructureConfig;
  data: DataConfig;
  authentication?: AuthenticationConfig;
  rbac?: RbacConfig;
}
