import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import Database from 'better-sqlite3';

import { DatabaseQuery } from '../types';
import { DatabaseConfig } from '../schema/config';

export default fp(async (fastify: FastifyInstance, opts: DatabaseConfig) => {
  let db: DatabaseQuery;

  if (opts.engine === 'pg') {
    const pool = new Pool({
      connectionString: opts.connection.urlOrPath,
    });

    db = {
      query: async <T, Q>(
        sql: string | { sql: string; text: string; values: T[] },
        params?: T[]
      ) => {
        let sqlStr: string;
        let p: T[] | undefined;

        if (typeof sql === 'object') {
          sqlStr = sql.text; // PG uses .text which has $1, $2 symbols
          p = sql.values;
        } else {
          sqlStr = sql;
          p = params;
        }

        const res = await pool.query(sqlStr, p);
        console.log({ res });
        return res.rows as Q[];
      },
      close: async () => pool.end(),
    };
  } else if (opts.engine === 'sqlite') {
    const sqlite = new Database(opts.connection.urlOrPath || './database.db');

    db = {
      query: async <T, Q>(
        sql: string | { sql: string; text: string; values: T[] },
        params?: T[]
      ) => {
        let sqlStr: string;
        let p: T[] | undefined;

        if (typeof sql === 'object') {
          sqlStr = sql.sql; // SQLite uses .sql which has ? symbols
          p = sql.values;
        } else {
          sqlStr = sql;
          p = params;
        }

        const stmt = sqlite.prepare(sqlStr);

        if (sqlStr.trim().toLowerCase().startsWith('select')) {
          return stmt.all(p || []) as Q[];
        }

        const res = stmt.run(p || []);
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
