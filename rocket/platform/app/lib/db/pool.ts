import {Pool} from 'pg';

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

export function getDbPool(): Pool {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not defined. Please configure it in your .env file.',
      );
    }

    globalForDb.pgPool = new Pool({
      connectionString,
    });
  }

  return globalForDb.pgPool;
}
