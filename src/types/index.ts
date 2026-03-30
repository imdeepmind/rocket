export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

export interface DatabaseQuery {
  query<Q>(sql: string, params?: unknown[]): Promise<Q[]>;
  close: () => Promise<void>;
}
