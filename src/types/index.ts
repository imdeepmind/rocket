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
    urlOrPath: string;
  };
}

export interface AppConfig {
  swagger: SwaggerConfig;
  database: DatabaseConfig;
}

export interface DatabaseQuery {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  close: () => Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseQuery;
  }
}
