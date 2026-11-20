import {Pool} from 'pg';

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not defined. Please configure it in your .env file.',
      );
    }

    poolInstance = new Pool({
      connectionString,
    });
  }

  return poolInstance;
}
