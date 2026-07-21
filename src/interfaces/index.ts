export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
  verbose: boolean;
  migrate: boolean;
}

export {DatabaseQuery} from './database';

export interface StructuredResponse<T = unknown, R = unknown> {
  code: number;
  message: string;
  data: T;
  raw_data?: R;
}

export interface WebhookPayload {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  resp?: unknown;
}

export type WebhookTriggerType = 'request' | 'response';
