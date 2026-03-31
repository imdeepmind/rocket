import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import Database from 'better-sqlite3';

import { DatabaseQuery } from '../types';
import { DatabaseConfig } from '../schema/config';

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
  const lowered = sql.trim().toLowerCase();
  return lowered.startsWith('select') || lowered.startsWith('with');
}

export default fp(async (fastify: FastifyInstance, opts: DatabaseConfig) => {
  let db: DatabaseQuery;

  if (opts.engine === 'pg') {
    const pool = new Pool({
      connectionString: opts.connection.urlOrPath,
    });

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
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
    const sqlite = new Database(opts.connection.urlOrPath || './database.db');

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
        const normalizedSql = normalizeSqliteParams(sql);
        const stmt = sqlite.prepare(normalizedSql);
        const queryParams = (params ?? []).map(normalizeSqliteValue);

        if (isSelectQuery(normalizedSql)) {
          return {
            changes: 0,
            rows: stmt.all(queryParams) as Q[],
          };
        }

        const res = stmt.run(queryParams);
        return {
          changes: res.changes ?? 0,
          rows: [] as Q[],
        };
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
    await db.close();
  });
});
