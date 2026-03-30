import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import Database from 'better-sqlite3';

import { DatabaseQuery } from '../types';
import { DatabaseConfig } from '../schema/config';

function normalizeSqliteParams(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

export default fp(async (fastify: FastifyInstance, opts: DatabaseConfig) => {
  let db: DatabaseQuery;

  if (opts.engine === 'pg') {
    const pool = new Pool({
      connectionString: opts.connection.urlOrPath,
    });

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params);
        console.log({ res });
        return res.rows as Q[];
      },
      close: async () => pool.end(),
    };
  } else if (opts.engine === 'sqlite') {
    const sqlite = new Database(opts.connection.urlOrPath || './database.db');

    db = {
      query: async <Q>(sql: string, params?: unknown[]) => {
        const normalizedSql = normalizeSqliteParams(sql);
        const stmt = sqlite.prepare(normalizedSql);
        const queryParams = params ?? [];

        if (normalizedSql.trim().toLowerCase().startsWith('select')) {
          return stmt.all(queryParams) as Q[];
        }

        const res = stmt.run(queryParams);
        return [res as unknown] as Q[];
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
