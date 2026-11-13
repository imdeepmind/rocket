export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface BaseCLIOptions {
  config?: string;
  verbose?: boolean;
}

export interface DevCLIOptions extends BaseCLIOptions {
  port?: number;
  host?: string;
  migrate?: boolean;
}

export interface StartCLIOptions extends BaseCLIOptions {
  port?: number;
  host?: string;
}

export interface MigrateCLIOptions extends BaseCLIOptions {}

export interface BuildCLIOptions extends BaseCLIOptions {}

export interface ConfigShowCLIOptions extends BaseCLIOptions {
  mode?: Mode;
  raw?: boolean;
}

export interface ConfigValidateCLIOptions extends BaseCLIOptions {
  mode?: Mode;
}

export interface RoutesCLIOptions extends BaseCLIOptions {
  mode?: Mode;
}

export type CLIOptions =
  | DevCLIOptions
  | StartCLIOptions
  | MigrateCLIOptions
  | BuildCLIOptions
  | ConfigShowCLIOptions
  | ConfigValidateCLIOptions
  | RoutesCLIOptions;

export {
  ClassifiedDatabaseError,
  DatabaseErrorLike,
  DatabaseQuery,
  TransactionClient,
} from './database';

export interface StructuredResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface WebhookPayload {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  response?: unknown;
}

export type WebhookTriggerType = 'request' | 'response';
