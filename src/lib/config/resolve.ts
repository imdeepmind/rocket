import {HTTPMethod, Mode} from '@/interfaces';
import {
  ApiKeyProvider,
  ApisConfig,
  AppConfigInput,
  ApplicationConfigInput,
  AuthenticationConfigInput,
  CacheDbConfig,
  CustomEndpointConfig,
  DocsConfigInput,
  DocsInfoConfig,
  ModelConfigInput,
  ModelFieldConfig,
  ModelIndexConfig,
  ModelRelationConfig,
  ResolvedApiKeyProvider,
  ResolvedAppConfig,
  ResolvedApplicationConfig,
  ResolvedAuthenticationConfig,
  ResolvedAuthProvider,
  ResolvedDatabaseConfig,
  ResolvedDataConfig,
  ResolvedDocsConfig,
  ResolvedInfrastructureConfig,
  ResolvedModelConfig,
  ResolvedModelFieldConfig,
  ResolvedModelIndexConfig,
  ResolvedModelRelationConfig,
  ResolvedUpAuthProvider,
  ResolvedUpAuthProviderConfig,
  UpAuthProvider,
  UpAuthProviderConfig,
  WebhookConfig,
} from '@/interfaces/config';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_LOG_LEVEL = 'info';

export const DEFAULT_RATE_LIMIT = {
  enabled: false,
  max: 100,
  timeWindow: '1m',
} as const;

export const DEFAULT_CORS = {
  enabled: false,
  origins: [] as string[],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'] as (
    | HTTPMethod
    | 'HEAD'
  )[],
  allowedHeaders: ['Content-Type', 'Authorization'] as string[],
  exposedHeaders: [] as string[],
  credentials: false,
  maxAge: 86400,
  routes: [] as string[],
} as const;

export const DEFAULT_DOCS_PATH = '/docs';

export const DEFAULT_DOCS_VERSION = '1.0.0';

/** Docs are enabled by default in dev and disabled in prod. */
export const DEFAULT_DOCS_ENABLED: Record<Mode, boolean> = {
  dev: true,
  prod: false,
} as const;

export const DEFAULT_DB_TIMEOUT = 10000;

export const DEFAULT_CACHE_TIMEOUT = 10000;

export const DEFAULT_SQLITE_URL = './database.db';

/** Database filled in when `infrastructure.database` is absent in dev. */
export const DEFAULT_DEV_DATABASE = {
  engine: 'sqlite',
  connection: {url: DEFAULT_SQLITE_URL},
  timeout: DEFAULT_DB_TIMEOUT,
} as const;

/** Resolved shape used whenever no Redis cache is configured. */
export const DEFAULT_MEMORY_CACHE = {engine: 'memory'} as const;

export const DEFAULT_TOKEN_EXPIRATION = '1d';

/** Boolean template merged into every resolved model field. */
export const DEFAULT_MODEL_FIELD = {
  primaryKey: false,
  autoIncrement: false,
  nullable: true,
  unique: false,
  secret: false,
} as const;

/** Resolved authentication shape when auth is absent or disabled. */
export const DEFAULT_AUTH_DISABLED = {enabled: false} as const;

/** Default variant segment when `dangerouslyOverrideDefaultVariant` is unset. */
export const DEFAULT_VARIANT = 'v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clone a value. Config values are JSON-safe, but structuredClone also
 * tolerates rich programmatic payloads the JSON schema allows.
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Error for invalid configuration emerging from resolution (e.g. a required
 * infrastructure section is missing in prod mode).
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(`Config error: ${message}`);
    this.name = 'ConfigError';
  }
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export function resolveApplication(
  input: ApplicationConfigInput = {},
): ResolvedApplicationConfig {
  return {
    name: input.name as string,
    logLevel: input.logLevel ?? DEFAULT_LOG_LEVEL,
    rateLimit: {
      enabled: input.rateLimit?.enabled ?? DEFAULT_RATE_LIMIT.enabled,
      max: input.rateLimit?.max ?? DEFAULT_RATE_LIMIT.max,
      timeWindow: input.rateLimit?.timeWindow ?? DEFAULT_RATE_LIMIT.timeWindow,
    },
    cors: {
      enabled: input.cors?.enabled ?? DEFAULT_CORS.enabled,
      origins: input.cors?.origins
        ? [...input.cors.origins]
        : [...DEFAULT_CORS.origins],
      methods: input.cors?.methods
        ? [...input.cors.methods]
        : [...DEFAULT_CORS.methods],
      allowedHeaders: input.cors?.allowedHeaders
        ? [...input.cors.allowedHeaders]
        : [...DEFAULT_CORS.allowedHeaders],
      exposedHeaders: input.cors?.exposedHeaders
        ? [...input.cors.exposedHeaders]
        : [...DEFAULT_CORS.exposedHeaders],
      credentials: input.cors?.credentials ?? DEFAULT_CORS.credentials,
      maxAge: input.cors?.maxAge ?? DEFAULT_CORS.maxAge,
      routes: input.cors?.routes
        ? [...input.cors.routes]
        : [...DEFAULT_CORS.routes],
    },
    dangerouslyOverrideDefaultVariant:
      input.dangerouslyOverrideDefaultVariant || DEFAULT_VARIANT,
    magicVariables: input.magicVariables ? clone(input.magicVariables) : {},
  };
}

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

export function resolveDocs(
  input: DocsConfigInput = {},
  mode: Mode,
  applicationName: string,
): ResolvedDocsConfig {
  const openapi = input.openapi ?? {};

  const info = (openapi.info ?? {}) as Partial<DocsInfoConfig>;

  const resolvedInfo: DocsInfoConfig = {
    title: info.title ?? applicationName,
    version: info.version ?? DEFAULT_DOCS_VERSION,
  };

  // Docs metadata stays optional and is never materialised.
  if ('description' in info) resolvedInfo.description = info.description;
  if ('termsOfService' in info)
    resolvedInfo.termsOfService = info.termsOfService;
  if ('contact' in info) resolvedInfo.contact = clone(info.contact);
  if ('license' in info) resolvedInfo.license = clone(info.license);

  return {
    openapi: {
      enabled: openapi.enabled ?? DEFAULT_DOCS_ENABLED[mode],
      path: openapi.path ?? DEFAULT_DOCS_PATH,
      info: resolvedInfo,
    },
  };
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export function resolveInfrastructure(
  infrastructure: AppConfigInput['infrastructure'],
  mode: Mode,
): ResolvedInfrastructureConfig {
  const database = infrastructure?.database;

  let resolvedDatabase: ResolvedDatabaseConfig;

  if (database) {
    resolvedDatabase = {
      engine: database.engine,
      connection: {url: database.connection.url},
      timeout: database.timeout ?? DEFAULT_DB_TIMEOUT,
    };
  } else if (mode !== 'prod') {
    resolvedDatabase = {...DEFAULT_DEV_DATABASE};
  } else {
    throw new ConfigError('infrastructure.database is required in prod mode');
  }

  return {
    database: resolvedDatabase,
    cache: resolveCache(infrastructure?.cache),
  };
}

function resolveCache(
  cache: CacheDbConfig | undefined,
): ResolvedInfrastructureConfig['cache'] {
  if (!cache || cache.engine === 'memory') {
    return {...DEFAULT_MEMORY_CACHE};
  }

  return {
    engine: 'redis',
    connection: {url: cache.connection?.url as string},
    timeout: cache.timeout ?? DEFAULT_CACHE_TIMEOUT,
  };
}

// ---------------------------------------------------------------------------
// Data / models / fields
// ---------------------------------------------------------------------------

export function resolveModelField(
  field: ModelFieldConfig,
): ResolvedModelFieldConfig {
  const resolved: ResolvedModelFieldConfig = {
    type: field.type,
    primaryKey: field.primaryKey ?? DEFAULT_MODEL_FIELD.primaryKey,
    autoIncrement: field.autoIncrement ?? DEFAULT_MODEL_FIELD.autoIncrement,
    nullable: field.nullable ?? DEFAULT_MODEL_FIELD.nullable,
    unique: field.unique ?? DEFAULT_MODEL_FIELD.unique,
    secret: field.secret ?? DEFAULT_MODEL_FIELD.secret,
    apis: field.apis ? [...field.apis] : [],
    query: field.query ? [...field.query] : [],
    aggregations: field.aggregations ? [...field.aggregations] : [],
  };

  // `values` / `default` stay optional and are never materialised.
  if ('default' in field) resolved.default = clone(field.default);
  if ('values' in field) resolved.values = [...(field.values ?? [])];

  return resolved;
}

export function resolveModelIndex(
  index: ModelIndexConfig,
): ResolvedModelIndexConfig {
  return {
    fields: [...index.fields],
    unique: index.unique ?? false,
  };
}

export function resolveModelRelation(
  relation: ModelRelationConfig,
): ResolvedModelRelationConfig {
  return {
    type: relation.type,
    model: relation.model,
    localField: relation.localField,
    foreignField: relation.foreignField,
    ...(relation.onDelete !== undefined ? {onDelete: relation.onDelete} : {}),
    ...(relation.onUpdate !== undefined ? {onUpdate: relation.onUpdate} : {}),
  };
}

export function resolveModel(model: ModelConfigInput): ResolvedModelConfig {
  const resolved: ResolvedModelConfig = {
    timestamps: model.timestamps ?? false,
    fields: Object.fromEntries(
      Object.entries(model.fields ?? {}).map(([name, field]) => [
        name,
        resolveModelField(field),
      ]),
    ),
    indexes: Object.fromEntries(
      Object.entries(model.indexes ?? {}).map(([name, index]) => [
        name,
        resolveModelIndex(index),
      ]),
    ),
    relations: Object.fromEntries(
      Object.entries(model.relations ?? {}).map(([name, relation]) => [
        name,
        resolveModelRelation(relation),
      ]),
    ),
  };

  // `validation` stays optional and is never materialised.
  if ('validation' in model)
    resolved.validation = clone(model.validation) as Record<string, unknown>;

  return resolved;
}

export function resolveData(data: AppConfigInput['data']): ResolvedDataConfig {
  return {
    models: Object.fromEntries(
      Object.entries(data?.models ?? {}).map(([name, model]) => [
        name,
        resolveModel(model),
      ]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export function resolveAuthentication(
  input: AuthenticationConfigInput | undefined,
): ResolvedAuthenticationConfig {
  if (!input || input.enabled !== true) {
    return {...DEFAULT_AUTH_DISABLED};
  }

  const provider = input.provider as ResolvedAuthProvider | undefined;

  if (!provider) {
    return {...DEFAULT_AUTH_DISABLED};
  }

  switch (provider.type) {
    case 'up-auth':
      return {
        enabled: true,
        provider: resolveUpAuthProvider(provider as UpAuthProvider),
      };
    case 'api-key':
      return {
        enabled: true,
        provider: resolveApiKeyProvider(provider as ApiKeyProvider),
      };
    default:
      return {...DEFAULT_AUTH_DISABLED};
  }
}

function resolveUpAuthProvider(
  provider: UpAuthProvider,
): ResolvedUpAuthProvider {
  return {
    type: 'up-auth',
    config: resolveUpAuthProviderConfig(provider.config),
  };
}

function resolveUpAuthProviderConfig(
  config: UpAuthProviderConfig,
): ResolvedUpAuthProviderConfig {
  return {
    userModel: clone(config.userModel),
    // jwtSecret is never defaulted; it must come from the user (or env).
    jwtSecret: config.jwtSecret as string,
    tokenExpiration: config.tokenExpiration ?? DEFAULT_TOKEN_EXPIRATION,
    mfaRequired: config.mfaRequired ?? false,
  };
}

function resolveApiKeyProvider(
  provider: ApiKeyProvider,
): ResolvedApiKeyProvider {
  return {
    type: 'api-key',
    config: clone(provider.config),
  };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function resolveWebhook(webhook: WebhookConfig): WebhookConfig {
  return {
    url: webhook.url,
    data: webhook.data ? clone(webhook.data) : [],
    triggerOnRequest: webhook.triggerOnRequest ?? false,
    triggerOnResponse: webhook.triggerOnResponse ?? false,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface ResolveConfigOptions {
  mode: Mode;
}

/**
 * Resolve a sparse, user-facing `AppConfigInput` into a dense
 * `ResolvedAppConfig`.
 *
 * Pure: the input is never mutated and the resolved config never shares
 * references with the input.
 */
export function resolveConfig(
  raw: AppConfigInput,
  {mode}: ResolveConfigOptions,
): ResolvedAppConfig {
  const application = resolveApplication(raw.application);

  const config: ResolvedAppConfig = {
    application,
    docs: resolveDocs(raw.docs, mode, application.name),
    infrastructure: resolveInfrastructure(raw.infrastructure, mode),
    data: resolveData(raw.data),
    apis: (raw.apis ? clone(raw.apis) : {}) as ApisConfig,
    customEndpoints: raw.customEndpoints
      ? clone(raw.customEndpoints as Record<string, CustomEndpointConfig>)
      : {},
    authentication: resolveAuthentication(raw.authentication),
    integrations: raw.integrations ? clone(raw.integrations) : {},
    apiVariants: raw.apiVariants ? clone(raw.apiVariants) : {},
  };

  return config;
}
