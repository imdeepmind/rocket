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
  query<T, Q>(sql: string, params?: T[]): Promise<Q[]>;
  close: () => Promise<void>;
}
