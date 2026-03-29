export type Mode = 'dev' | 'prod';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type DBEngine = 'sqlite' | 'pg';

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

export interface SwaggerConfig {
  enabled: boolean;
  basePath: string;
  info: {
    title: string;
    description: string;
    version: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
}

export interface DatabaseConfig {
  engine: DBEngine;
  connection: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    path?: string;
  };
}

export interface AppConfig {
  swagger: SwaggerConfig;
  database: DatabaseConfig;
}
