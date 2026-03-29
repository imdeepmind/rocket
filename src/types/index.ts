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

export interface AppConfig {
  swagger: {
    enabled: boolean;
    basePath: string;
    info: {
      title: string;
      description: string;
      version: string;
    };
  };
}
