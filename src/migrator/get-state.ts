import { FastifyInstance } from 'fastify';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleSqlite, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { Database } from 'better-sqlite3';
import type { Pool } from 'pg';

import { DBEngine } from '../schema/config';

const getCurrentStateOfDb = (
  app: FastifyInstance,
  engine: DBEngine
): NodePgDatabase<Record<string, unknown>> | BetterSQLite3Database<Record<string, unknown>> => {
  if (engine === 'sqlite') {
    return drizzleSqlite(app.db.dbPoolOrConnection as Database);
  }

  return drizzlePg(app.db.dbPoolOrConnection as Pool);
};

export default getCurrentStateOfDb;
