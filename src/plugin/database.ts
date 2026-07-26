import Database from 'better-sqlite3';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {Pool} from 'pg';

import {DatabaseQuery} from '@/interfaces';

function normalizeSqliteParams(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

function normalizeSqliteValue(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function isSelectQuery(sql: string): boolean {
  const cleanSql = sql
    .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '')
    .trim()
    .toLowerCase();
  return cleanSql.startsWith('select') || cleanSql.startsWith('with');
}

function isDdlQuery(sql: string): boolean {
  const cleanSql = sql
    .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '')
    .trim()
    .toLowerCase();

  const ddlPattern =
    /^(create|alter|drop|truncate|rename|comment|grant|revoke)\b/i;
  return ddlPattern.test(cleanSql);
}

function makeQueryExecutor(
  runQuery: (
    sql: string,
    params: unknown[],
  ) => Promise<{changes: number; rows: unknown[]}>,
) {
  return async <Q>(sql: string, params?: unknown[]) => {
    if (isDdlQuery(sql)) {
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

export default fp(async (fastify: FastifyInstance) => {
  const dbConfig = fastify.appConfig.infrastructure.database;
  let dbInstance: DatabaseQuery;
  const timeout = dbConfig.timeout ?? 10000;

  if (dbConfig.engine === 'postgres') {
    const pool = new Pool({
      connectionString: dbConfig.connection.url,
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

    dbInstance = {
      query: makeQueryExecutor(pgQueryFn),
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
          }),
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
  } else if (dbConfig.engine === 'sqlite') {
    const sqlite = new Database(dbConfig.connection.url, {timeout});

    const sqliteQueryFn = async (sql: string, params: unknown[]) => {
      const normalizedSql = normalizeSqliteParams(sql);
      const stmt = sqlite.prepare(normalizedSql);
      const queryParams = params.map(normalizeSqliteValue);

      return new Promise<{changes: number; rows: unknown[]}>(
        (resolve, reject) => {
          try {
            if (isSelectQuery(normalizedSql)) {
              const rows = stmt.all(queryParams) as unknown[];
              resolve({changes: 0, rows});
            } else {
              const res = stmt.run(queryParams);
              resolve({changes: res.changes ?? 0, rows: [] as unknown[]});
            }
          } catch (err) {
            reject(err);
          }
        },
      );
    };

    dbInstance = {
      query: makeQueryExecutor(sqliteQueryFn),
      close: async () => {
        sqlite.close();
      },
      beginTransaction: async () => {
        sqlite.exec('BEGIN');
        return {
          query: makeQueryExecutor(async (sql, params) => {
            const normalizedSql = normalizeSqliteParams(sql);
            const stmt = sqlite.prepare(normalizedSql);
            const queryParams = params.map(normalizeSqliteValue);

            return new Promise<{changes: number; rows: unknown[]}>(
              (resolve, reject) => {
                try {
                  if (isSelectQuery(normalizedSql)) {
                    const rows = stmt.all(queryParams) as unknown[];
                    resolve({changes: 0, rows});
                  } else {
                    const res = stmt.run(queryParams);
                    resolve({changes: res.changes ?? 0, rows: [] as unknown[]});
                  }
                } catch (err) {
                  reject(err);
                }
              },
            );
          }),
          commit: async () => {
            sqlite.exec('COMMIT');
          },
          rollback: async () => {
            sqlite.exec('ROLLBACK');
          },
          release: () => {
            // SQLite is single-connection, nothing to release
          },
        };
      },
    };
  } else {
    throw new Error(`Unsupported database engine: ${dbConfig.engine}`);
  }

  fastify.decorate('db', dbInstance);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connection...');
    await dbInstance.close();
    fastify.log.info('Database connection closed.');
  });
});
