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
  code: string;
  message?: unknown;
  detail?: unknown;
}

export interface ClassifiedDatabaseError {
  statusCode: number;
  message: string;
}
