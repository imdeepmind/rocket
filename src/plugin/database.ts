import Database from 'better-sqlite3';
import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {Pool} from 'pg';

import {DatabaseQuery} from '@/schema';
import {DatabaseConfig} from '@/schema/config';

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

export default fp(async (fastify: FastifyInstance, opts: DatabaseConfig) => {
  let db: DatabaseQuery;
  const timeout = opts.dbTimeout ?? 10000;

  if (opts.engine === 'pg') {
    const pool = new Pool({
      connectionString: opts.connection.urlOrPath,
      statement_timeout: timeout,
      query_timeout: timeout, // client-side timeout to cancel the query
    });

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
        if (isDdlQuery(sql)) {
          throw new Error(
            'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
          );
        }

        const queryParams = params ?? [];
        const select = isSelectQuery(sql);

        if (select) {
          const res = await pool.query(sql, queryParams);
          return {
            changes: 0,
            rows: res.rows as Q[],
          };
        }

        const res = await pool.query(sql, queryParams);
        return {
          changes: res.rowCount ?? 0,
          rows: [] as Q[],
        };
      },
      close: async () => pool.end(),
    };
  } else if (opts.engine === 'sqlite') {
    // SQLite busy timeout (how long to wait for table locks)
    const sqlite = new Database(opts.connection.urlOrPath, {timeout});

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
        if (isDdlQuery(sql)) {
          throw new Error(
            'DDL queries (CREATE, ALTER, DROP, etc.) are not allowed.',
          );
        }

        const normalizedSql = normalizeSqliteParams(sql);
        const stmt = sqlite.prepare(normalizedSql);
        const queryParams = (params ?? []).map(normalizeSqliteValue);

        // SQLite with better-sqlite3 is synchronous and blocks the loop.
        // We wrap it in a promise-based structure for API consistency with PG.
        return new Promise<{changes: number; rows: Q[]}>((resolve, reject) => {
          try {
            if (isSelectQuery(normalizedSql)) {
              const rows = stmt.all(queryParams) as Q[];
              resolve({changes: 0, rows});
            } else {
              const res = stmt.run(queryParams);
              resolve({changes: res.changes ?? 0, rows: [] as Q[]});
            }
          } catch (err) {
            reject(err);
          }
        });
      },
      close: async () => {
        sqlite.close();
      },
    };
  } else {
    throw new Error(`Unsupported database engine: ${opts.engine}`);
  }

  // attach to fastify
  fastify.decorate('db', db);

  // cleanup on shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connection...');
    await db.close();
    fastify.log.info('Database connection closed.');
  });
});
