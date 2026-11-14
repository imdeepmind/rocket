import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import {Pool} from 'pg';

import {DBEngine} from '@/interfaces/config';
import {DatabaseQuery} from '@/interfaces/database';

import {AsyncMutex} from '@/utils/mutex';

import {
  isDdlQuery,
  isSelectQuery,
  normalizeSqliteParams,
  normalizeSqliteValue,
} from './query';

export interface CreateDatabaseClientOptions {
  engine: DBEngine;
  url: string;
  timeout?: number;
  allowDdl?: boolean;
  multipleStatements?: boolean;
}

function makeQueryExecutor(
  runQuery: (
    sql: string,
    params: unknown[],
  ) => Promise<{changes: number; rows: unknown[]}>,
  allowDdl = false,
) {
  return async <Q>(sql: string, params?: unknown[]) => {
    if (!allowDdl && isDdlQuery(sql)) {
      throw new Error(
        'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
      );
    }
    return (await runQuery(sql, params ?? [])) as {
      changes: number;
      rows: Q[];
    };
  };
}

export function createDatabaseClient(
  options: CreateDatabaseClientOptions,
): DatabaseQuery {
  const {
    engine,
    url,
    timeout,
    allowDdl = false,
    multipleStatements = false,
  } = options;

  if (engine === 'postgres') {
    const pool = new Pool({
      connectionString: url,
      statement_timeout: timeout,
      query_timeout: timeout,
    });

    const pgQueryFn = async (sql: string, params: unknown[]) => {
      const select = isSelectQuery(sql);
      if (select) {
        const res = await pool.query(sql, params);
        return {changes: 0, rows: res.rows as unknown[]};
      }
      const res = await pool.query(sql, params);
      return {changes: res.rowCount ?? 0, rows: [] as unknown[]};
    };

    return {
      query: makeQueryExecutor(pgQueryFn, allowDdl),
      close: async () => pool.end(),
      beginTransaction: async () => {
        const client = await pool.connect();
        await client.query('BEGIN');
        return {
          query: makeQueryExecutor(async (sql, params) => {
            const select = isSelectQuery(sql);
            if (select) {
              const res = await client.query(sql, params);
              return {changes: 0, rows: res.rows as unknown[]};
            }
            const res = await client.query(sql, params);
            return {changes: res.rowCount ?? 0, rows: [] as unknown[]};
          }, allowDdl),
          commit: async () => {
            await client.query('COMMIT');
          },
          rollback: async () => {
            await client.query('ROLLBACK');
          },
          release: () => {
            client.release();
          },
        };
      },
    };
  }

  if (engine === 'sqlite') {
    const sqlite = new Database(
      url,
      timeout !== undefined ? {timeout} : undefined,
    );
    const txMutex = new AsyncMutex();

    const sqliteQueryFn = async (sql: string, params: unknown[]) => {
      const normalizedSql = normalizeSqliteParams(sql);
      const queryParams = params.map(normalizeSqliteValue);

      return new Promise<{changes: number; rows: unknown[]}>(
        (resolve, reject) => {
          try {
            if (isSelectQuery(normalizedSql)) {
              const stmt = sqlite.prepare(normalizedSql);
              const rows = stmt.all(queryParams) as unknown[];
              resolve({changes: 0, rows});
            } else if (multipleStatements && queryParams.length === 0) {
              sqlite.exec(normalizedSql);
              resolve({changes: 0, rows: []});
            } else {
              const stmt = sqlite.prepare(normalizedSql);
              const res = stmt.run(queryParams);
              resolve({changes: res.changes ?? 0, rows: [] as unknown[]});
            }
          } catch (err) {
            reject(err);
          }
        },
      );
    };

    return {
      query: makeQueryExecutor(sqliteQueryFn, allowDdl),
      close: async () => {
        sqlite.close();
      },
      beginTransaction: async () => {
        const unlock = await txMutex.acquire();
        try {
          sqlite.exec('BEGIN');
        } catch (err) {
          unlock();
          throw err;
        }

        let isFinished = false;
        const endTransaction = (action: 'COMMIT' | 'ROLLBACK') => {
          if (isFinished) {
            return;
          }
          isFinished = true;
          try {
            sqlite.exec(action);
          } finally {
            unlock();
          }
        };

        return {
          query: makeQueryExecutor(sqliteQueryFn, allowDdl),
          commit: async () => {
            endTransaction('COMMIT');
          },
          rollback: async () => {
            endTransaction('ROLLBACK');
          },
          release: () => {
            if (!isFinished) {
              endTransaction('ROLLBACK');
            }
          },
        };
      },
    };
  }

  if (engine === 'mysql') {
    const pool = multipleStatements
      ? mysql.createPool({uri: url, multipleStatements: true})
      : mysql.createPool(url);

    pool.on('connection', connection => {
      if (typeof (connection as {query?: unknown}).query === 'function') {
        try {
          (
            connection as unknown as {
              query: (sql: string, cb: () => void) => unknown;
            }
          ).query(
            "SET SESSION sql_mode = CONCAT(IFNULL(@@sql_mode, ''), ',ANSI_QUOTES')",
            () => {},
          );
        } catch {
          // Ignore connection configuration errors
        }
      }
    });

    const mysqlQueryFn = async (sql: string, params: unknown[]) => {
      const normalizedSql = normalizeSqliteParams(sql);
      const queryParams = params.map(normalizeSqliteValue);
      const [result] = await pool.query(normalizedSql, queryParams);
      if (isSelectQuery(normalizedSql)) {
        return {changes: 0, rows: (result as unknown[]) ?? []};
      }
      return {
        changes: (result as {affectedRows?: number})?.affectedRows ?? 0,
        rows: [] as unknown[],
      };
    };

    return {
      query: makeQueryExecutor(mysqlQueryFn, allowDdl),
      close: async () => {
        await pool.end();
      },
      beginTransaction: async () => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        let isFinished = false;
        return {
          query: makeQueryExecutor(async (sql, params) => {
            const normalizedSql = normalizeSqliteParams(sql);
            const queryParams = params.map(normalizeSqliteValue);
            const [result] = await connection.query(normalizedSql, queryParams);
            if (isSelectQuery(normalizedSql)) {
              return {changes: 0, rows: (result as unknown[]) ?? []};
            }
            return {
              changes: (result as {affectedRows?: number})?.affectedRows ?? 0,
              rows: [] as unknown[],
            };
          }, allowDdl),
          commit: async () => {
            isFinished = true;
            await connection.commit();
          },
          rollback: async () => {
            isFinished = true;
            try {
              await connection.rollback();
            } catch {
              // Ignore rollback failure if already aborted
            }
          },
          release: () => {
            if (!isFinished) {
              try {
                void connection.rollback();
              } catch {
                // Ignore
              }
            }
            connection.release();
          },
        };
      },
    };
  }

  throw new Error(`Unsupported database engine: ${engine as string}`);
}
