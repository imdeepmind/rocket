import {DBEngine} from '@/interfaces/config';

export interface CreateDatabaseClientOptions {
  engine: DBEngine;
  url: string;
  timeout?: number;
  allowDdl?: boolean;
  multipleStatements?: boolean;
}

export interface TransactionClient {
  query<Q>(
    sql: string,
    params?: unknown[],
  ): Promise<{changes: number; rows: Q[]}>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface DatabaseQuery {
  query<Q>(
    sql: string,
    params?: unknown[],
  ): Promise<{changes: number; rows: Q[]}>;
  close: () => Promise<void>;
  beginTransaction(): Promise<TransactionClient>;
}

export interface DatabaseErrorLike {
  code?: string;
  name?: string;
  message?: unknown;
  detail?: unknown;
}

export interface ClassifiedDatabaseError {
  statusCode: number;
  message: string;
}
