import { CLIOptions, HTTPMethod, Mode } from '../../interfaces/index.js';
import { AppConfigInput, ApplicationConfigInput, AuthenticationConfigInput, DocsConfigInput, ModelConfigInput, ModelFieldConfig, ModelIndexConfig, ModelRelationConfig, RbacConfig, ResolvedAppConfig, ResolvedApplicationConfig, ResolvedAuthenticationConfig, ResolvedDataConfig, ResolvedDocsConfig, ResolvedInfrastructureConfig, ResolvedModelConfig, ResolvedModelFieldConfig, ResolvedModelIndexConfig, ResolvedModelRelationConfig, WebhookConfig } from '../../interfaces/config.js';
export declare const DEFAULT_LOG_LEVEL = "info";
export declare const DEFAULT_RATE_LIMIT: {
    readonly enabled: false;
    readonly max: 100;
    readonly timeWindow: "1m";
    readonly rateLimitHealthAPI: false;
};
export declare const DEFAULT_CORS: {
    readonly enabled: false;
    readonly origins: string[];
    readonly methods: (HTTPMethod | "HEAD" | "OPTIONS")[];
    readonly allowedHeaders: string[];
    readonly exposedHeaders: string[];
    readonly credentials: false;
    readonly maxAge: 86400;
    readonly routes: string[];
};
export declare const DEFAULT_DOCS_PATH = "/docs";
export declare const DEFAULT_DOCS_VERSION = "1.0.0";
/** Docs are enabled by default in dev and disabled in prod. */
export declare const DEFAULT_DOCS_ENABLED: Record<Mode, boolean>;
export declare const DEFAULT_DB_TIMEOUT = 10000;
export declare const DEFAULT_CACHE_TIMEOUT = 10000;
export declare const DEFAULT_HEALTH_CHECK: {
    readonly enabled: true;
    readonly path: "/api/health";
};
export declare const DEFAULT_SQLITE_URL = "./database.db";
/** Database filled in when `infrastructure.database` is absent in dev. */
export declare const DEFAULT_DEV_DATABASE: {
    readonly engine: "sqlite";
    readonly connection: {
        readonly url: "./database.db";
    };
    readonly timeout: 10000;
};
/** Resolved shape used whenever no Redis cache is configured. */
export declare const DEFAULT_MEMORY_CACHE: {
    readonly engine: "memory";
};
export declare const DEFAULT_TOKEN_EXPIRATION = "1d";
/** Boolean template merged into every resolved model field. */
export declare const DEFAULT_MODEL_FIELD: {
    readonly primaryKey: false;
    readonly autoIncrement: false;
    readonly nullable: true;
    readonly unique: false;
    readonly secret: false;
};
/** Resolved authentication shape when auth is absent or disabled. */
export declare const DEFAULT_AUTH_DISABLED: {
    readonly enabled: false;
};
/** Resolved RBAC shape when rbac is absent or disabled. */
export declare const DEFAULT_RBAC_DISABLED: {
    readonly enabled: false;
};
/** Default variant segment when `dangerouslyOverrideDefaultVariant` is unset. */
export declare const DEFAULT_VARIANT = "v1";
/**
 * Error for invalid configuration emerging from resolution (e.g. a required
 * infrastructure section is missing in prod mode).
 */
export declare class ConfigError extends Error {
    constructor(message: string);
}
export declare function resolveApplication(input?: ApplicationConfigInput, cliOptions?: CLIOptions): ResolvedApplicationConfig;
export declare function resolveDocs(input: DocsConfigInput | undefined, mode: Mode, applicationName: string): ResolvedDocsConfig;
export declare function resolveInfrastructure(infrastructure: AppConfigInput['infrastructure'], mode: Mode, configDir?: string, cliOptions?: CLIOptions): ResolvedInfrastructureConfig;
export declare function resolveModelField(field: ModelFieldConfig): ResolvedModelFieldConfig;
export declare function resolveModelIndex(index: ModelIndexConfig): ResolvedModelIndexConfig;
export declare function resolveModelRelation(relation: ModelRelationConfig): ResolvedModelRelationConfig;
export declare function resolveModel(model: ModelConfigInput): ResolvedModelConfig;
export declare function resolveData(data: AppConfigInput['data']): ResolvedDataConfig;
export declare function resolveAuthentication(input: AuthenticationConfigInput | undefined): ResolvedAuthenticationConfig;
export declare function resolveWebhook(webhook: WebhookConfig): WebhookConfig;
export declare function resolveRbac(input?: RbacConfig): RbacConfig;
export interface ResolveConfigOptions {
    mode: Mode;
    configDir?: string;
    cliOptions?: CLIOptions;
}
/**
 * Resolve a sparse, user-facing `AppConfigInput` into a dense
 * `ResolvedAppConfig`.
 *
 * Pure: the input is never mutated and the resolved config never shares
 * references with the input.
 */
export declare function resolveConfig(raw: AppConfigInput, { mode, configDir, cliOptions }: ResolveConfigOptions): ResolvedAppConfig;
