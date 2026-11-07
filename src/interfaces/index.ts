export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
  verbose: boolean;
  migrate: boolean;
  printConfig: boolean;
}

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
