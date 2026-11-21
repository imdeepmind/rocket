import {drizzle} from 'drizzle-orm/node-postgres';

import {getDbPool} from '@/lib/db/pool';
import * as schema from '@/lib/db/schema';

export const db = drizzle(getDbPool(), {schema});
export type Database = typeof db;
export {schema};
export * from '@/lib/db/schema';
