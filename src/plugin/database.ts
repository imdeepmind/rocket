import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import { DatabaseConfig, DatabaseQuery } from '../types';

export default fp(async (fastify: FastifyInstance, opts: DatabaseConfig) => {
  let db: DatabaseQuery;

  if (opts.engine === 'pg') {
    const pool = new Pool({
      connectionString: opts.connection.urlOrPath,
    });

    db = {
      query: async <T, Q>(sql: string, params?: T[]) => {
        const res = await pool.query(sql, params);
        return res.rows as Q[];
      },
      close: async () => pool.end(),
    };
  } else if (opts.engine === 'sqlite') {
    const sqlite = new Database(opts.connection.urlOrPath || './database.db');

    db = {
      query: async <T, Q>(sql: string, params?: T[]) => {
        const stmt = sqlite.prepare(sql);

        if (sql.trim().toLowerCase().startsWith('select')) {
          return stmt.all(params || []) as Q[];
        }

        const res = stmt.run(params || []);
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
