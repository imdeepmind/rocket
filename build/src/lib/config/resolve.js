import * as path from 'path';
// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
export const DEFAULT_LOG_LEVEL = 'info';
export const DEFAULT_RATE_LIMIT = {
    enabled: false,
    max: 100,
    timeWindow: '1m',
    rateLimitHealthAPI: false,
};
export const DEFAULT_CORS = {
    enabled: false,
    origins: [],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400,
    routes: [],
};
export const DEFAULT_DOCS_PATH = '/docs';
export const DEFAULT_DOCS_VERSION = '1.0.0';
/** Docs are enabled by default in dev and disabled in prod. */
export const DEFAULT_DOCS_ENABLED = {
    dev: true,
    prod: false,
};
export const DEFAULT_DB_TIMEOUT = 10000;
export const DEFAULT_CACHE_TIMEOUT = 10000;
export const DEFAULT_HEALTH_CHECK = {
    enabled: true,
    path: '/api/health',
};
export const DEFAULT_SQLITE_URL = './database.db';
/** Database filled in when `infrastructure.database` is absent in dev. */
export const DEFAULT_DEV_DATABASE = {
    engine: 'sqlite',
    connection: { url: DEFAULT_SQLITE_URL },
    timeout: DEFAULT_DB_TIMEOUT,
};
/** Resolved shape used whenever no Redis cache is configured. */
export const DEFAULT_MEMORY_CACHE = { engine: 'memory' };
export const DEFAULT_TOKEN_EXPIRATION = '1d';
/** Boolean template merged into every resolved model field. */
export const DEFAULT_MODEL_FIELD = {
    primaryKey: false,
    autoIncrement: false,
    nullable: true,
    unique: false,
    secret: false,
};
/** Resolved authentication shape when auth is absent or disabled. */
export const DEFAULT_AUTH_DISABLED = { enabled: false };
/** Resolved RBAC shape when rbac is absent or disabled. */
export const DEFAULT_RBAC_DISABLED = { enabled: false };
/** Default variant segment when `dangerouslyOverrideDefaultVariant` is unset. */
export const DEFAULT_VARIANT = 'v1';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Deep-clone a value. Config values are JSON-safe, but structuredClone also
 * tolerates rich programmatic payloads the JSON schema allows.
 */
function clone(value) {
    return structuredClone(value);
}
/**
 * Error for invalid configuration emerging from resolution (e.g. a required
 * infrastructure section is missing in prod mode).
 */
export class ConfigError extends Error {
    constructor(message) {
        super(`Config error: ${message}`);
        this.name = 'ConfigError';
    }
}
// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
export function resolveApplication(input = {}, cliOptions) {
    const logLevel = cliOptions?.verbose === true
        ? 'trace'
        : (input.logLevel ?? DEFAULT_LOG_LEVEL);
    return {
        name: input.name,
        logLevel,
        rateLimit: {
            enabled: input.rateLimit?.enabled ?? DEFAULT_RATE_LIMIT.enabled,
            max: input.rateLimit?.max ?? DEFAULT_RATE_LIMIT.max,
            timeWindow: input.rateLimit?.timeWindow ?? DEFAULT_RATE_LIMIT.timeWindow,
            rateLimitHealthAPI: input.rateLimit?.rateLimitHealthAPI ??
                DEFAULT_RATE_LIMIT.rateLimitHealthAPI,
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
        dangerouslyOverrideDefaultVariant: input.dangerouslyOverrideDefaultVariant ?? DEFAULT_VARIANT,
        magicVariables: input.magicVariables ? clone(input.magicVariables) : {},
        healthCheck: {
            enabled: input.healthCheck?.enabled ?? DEFAULT_HEALTH_CHECK.enabled,
            path: input.healthCheck?.path ?? DEFAULT_HEALTH_CHECK.path,
        },
    };
}
// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------
export function resolveDocs(input = {}, mode, applicationName) {
    const openapi = input.openapi ?? {};
    const info = (openapi.info ?? {});
    const resolvedInfo = {
        title: info.title ?? applicationName,
        version: info.version ?? DEFAULT_DOCS_VERSION,
    };
    // Docs metadata stays optional and is never materialised.
    if ('description' in info)
        resolvedInfo.description = info.description;
    if ('termsOfService' in info)
        resolvedInfo.termsOfService = info.termsOfService;
    if ('contact' in info)
        resolvedInfo.contact = clone(info.contact);
    if ('license' in info)
        resolvedInfo.license = clone(info.license);
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
export function resolveInfrastructure(infrastructure, mode, configDir, cliOptions) {
    const database = infrastructure?.database;
    let resolvedDatabase;
    if (database) {
        resolvedDatabase = {
            engine: database.engine,
            connection: { url: database.connection.url },
            timeout: database.timeout ?? DEFAULT_DB_TIMEOUT,
        };
        if (database.migrations) {
            const baseDir = configDir ?? process.cwd();
            const dangerouslyAllowDDL = (cliOptions &&
                'dangerouslyAllowDdl' in cliOptions &&
                Boolean(cliOptions.dangerouslyAllowDdl)) ||
                Boolean(database.migrations.dangerouslyAllowDDL);
            resolvedDatabase.migrations = {
                directory: path.resolve(baseDir, database.migrations.directory),
                dangerouslyAllowDDL,
            };
        }
    }
    else if (mode !== 'prod') {
        resolvedDatabase = { ...DEFAULT_DEV_DATABASE };
    }
    else {
        throw new ConfigError('infrastructure.database is required in prod mode');
    }
    return {
        database: resolvedDatabase,
        cache: resolveCache(infrastructure?.cache),
    };
}
function resolveCache(cache) {
    if (!cache || cache.engine === 'memory') {
        return { ...DEFAULT_MEMORY_CACHE };
    }
    return {
        engine: cache.engine,
        connection: { url: cache.connection?.url },
        timeout: cache.timeout ?? DEFAULT_CACHE_TIMEOUT,
    };
}
// ---------------------------------------------------------------------------
// Data / models / fields
// ---------------------------------------------------------------------------
export function resolveModelField(field) {
    const resolved = {
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
    if ('default' in field)
        resolved.default = clone(field.default);
    if ('values' in field)
        resolved.values = [...(field.values ?? [])];
    return resolved;
}
export function resolveModelIndex(index) {
    return {
        fields: [...index.fields],
        unique: index.unique ?? false,
    };
}
export function resolveModelRelation(relation) {
    return {
        type: relation.type,
        model: relation.model,
        localField: relation.localField,
        foreignField: relation.foreignField,
        ...(relation.onDelete !== undefined ? { onDelete: relation.onDelete } : {}),
        ...(relation.onUpdate !== undefined ? { onUpdate: relation.onUpdate } : {}),
    };
}
export function resolveModel(model) {
    const resolved = {
        timestamps: model.timestamps ?? false,
        fields: Object.fromEntries(Object.entries(model.fields ?? {}).map(([name, field]) => [
            name,
            resolveModelField(field),
        ])),
        indexes: Object.fromEntries(Object.entries(model.indexes ?? {}).map(([name, index]) => [
            name,
            resolveModelIndex(index),
        ])),
        relations: Object.fromEntries(Object.entries(model.relations ?? {}).map(([name, relation]) => [
            name,
            resolveModelRelation(relation),
        ])),
    };
    // `validation` stays optional and is never materialised.
    if ('validation' in model)
        resolved.validation = clone(model.validation);
    return resolved;
}
export function resolveData(data) {
    return {
        models: Object.fromEntries(Object.entries(data?.models ?? {}).map(([name, model]) => [
            name,
            resolveModel(model),
        ])),
    };
}
// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
export function resolveAuthentication(input) {
    if (!input || input.enabled !== true) {
        return { ...DEFAULT_AUTH_DISABLED };
    }
    const { userModel, providers } = input;
    // Validation reports the precise errors; resolution falls back to "disabled"
    // so downstream code never observes a half-configured auth engine.
    if (!providers || providers.length === 0) {
        return { ...DEFAULT_AUTH_DISABLED };
    }
    const hasIdentityProvider = providers.some(provider => provider.type !== 'api-key');
    if (hasIdentityProvider && !userModel) {
        return { ...DEFAULT_AUTH_DISABLED };
    }
    return {
        enabled: true,
        ...(input.jwtSecret ? { jwtSecret: input.jwtSecret } : {}),
        tokenExpiration: input.tokenExpiration ?? DEFAULT_TOKEN_EXPIRATION,
        ...(userModel ? { userModel: { ...userModel } } : {}),
        providers: providers
            .filter(provider => provider.type === 'up-auth' ||
            provider.type === 'api-key' ||
            provider.type === 'sso')
            .map(resolveAuthProvider),
    };
}
function resolveAuthProvider(provider) {
    switch (provider.type) {
        case 'up-auth':
            return resolveUpAuthProvider(provider);
        case 'api-key':
            return resolveApiKeyProvider(provider);
        case 'sso':
            return resolveSsoProvider(provider);
    }
}
function resolveUpAuthProvider(provider) {
    return {
        type: 'up-auth',
        config: {
            fields: { ...provider.config.fields },
            mfaRequired: provider.config.mfaRequired ?? false,
        },
    };
}
function resolveApiKeyProvider(provider) {
    return {
        type: 'api-key',
        config: { ...provider.config },
    };
}
function resolveSsoBase(provider) {
    return {
        fields: { ...provider.config.fields },
        attributeMapping: { ...(provider.config.attributeMapping ?? {}) },
        scopes: [...(provider.config.scopes ?? [])],
        ...(provider.config.callbackUrl
            ? { callbackUrl: provider.config.callbackUrl }
            : {}),
        ...(provider.config.redirectUrl
            ? { redirectUrl: provider.config.redirectUrl }
            : {}),
        ...(provider.config.failureRedirectUrl
            ? { failureRedirectUrl: provider.config.failureRedirectUrl }
            : {}),
    };
}
function resolveSsoProvider(provider) {
    const base = resolveSsoBase(provider);
    if (provider.protocol === 'oauth2') {
        return {
            type: 'sso',
            name: provider.name,
            protocol: 'oauth2',
            config: {
                ...base,
                authorizeUrl: provider.config.authorizeUrl,
                tokenUrl: provider.config.tokenUrl,
                ...(provider.config.userInfoUrl
                    ? { userInfoUrl: provider.config.userInfoUrl }
                    : {}),
                ...(provider.config.idClaim ? { idClaim: provider.config.idClaim } : {}),
                clientId: provider.config.clientId,
                clientSecret: provider.config.clientSecret,
            },
        };
    }
    if (provider.protocol === 'oidc') {
        return {
            type: 'sso',
            name: provider.name,
            protocol: 'oidc',
            config: {
                ...base,
                scopes: base.scopes.length > 0
                    ? Array.from(new Set(['openid', ...base.scopes]))
                    : ['openid', 'profile'],
                issuerUrl: provider.config.issuerUrl,
                clientId: provider.config.clientId,
                clientSecret: provider.config.clientSecret,
            },
        };
    }
    return {
        type: 'sso',
        name: provider.name,
        protocol: 'saml',
        config: {
            ...base,
            entryPoint: provider.config.entryPoint,
            issuer: provider.config.issuer,
            cert: provider.config.cert,
        },
    };
}
// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
export function resolveWebhook(webhook) {
    return {
        url: webhook.url,
        data: webhook.data ? clone(webhook.data) : [],
        triggerOnRequest: webhook.triggerOnRequest ?? false,
        triggerOnResponse: webhook.triggerOnResponse ?? false,
    };
}
// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------
export function resolveRbac(input) {
    if (!input || input.enabled !== true) {
        return { ...DEFAULT_RBAC_DISABLED };
    }
    return clone(input);
}
/**
 * Resolve a sparse, user-facing `AppConfigInput` into a dense
 * `ResolvedAppConfig`.
 *
 * Pure: the input is never mutated and the resolved config never shares
 * references with the input.
 */
export function resolveConfig(raw, { mode, configDir, cliOptions }) {
    const application = resolveApplication(raw.application, cliOptions);
    const config = {
        application,
        docs: resolveDocs(raw.docs, mode, application.name),
        infrastructure: resolveInfrastructure(raw.infrastructure, mode, configDir, cliOptions),
        data: resolveData(raw.data),
        apis: (raw.apis ? clone(raw.apis) : {}),
        customEndpoints: raw.customEndpoints
            ? clone(raw.customEndpoints)
            : {},
        authentication: resolveAuthentication(raw.authentication),
        integrations: raw.integrations ? clone(raw.integrations) : {},
        apiVariants: raw.apiVariants ? clone(raw.apiVariants) : {},
        rbac: resolveRbac(raw.rbac),
    };
    return config;
}
//# sourceMappingURL=resolve.js.map