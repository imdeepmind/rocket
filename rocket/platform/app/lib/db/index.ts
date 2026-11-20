import { drizzle } from 'drizzle-orm/node-postgres';
import { getDbPool } from './pool';
import * as schema from './schema';

export const db = drizzle(getDbPool(), { schema });
export type Database = typeof db;
export { schema };
export * from './schema';

