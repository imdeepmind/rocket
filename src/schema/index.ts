export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

export interface DatabaseQuery {
  query<Q>(
    sql: string,
    params?: unknown[],
  ): Promise<{changes: number; rows: Q[]}>;
  close: () => Promise<void>;
}

export interface StructuredResponse<T = unknown, R = unknown> {
  code: number;
  message: string;
  data: T;
  raw_data?: R;
}
