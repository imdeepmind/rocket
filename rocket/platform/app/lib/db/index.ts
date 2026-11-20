import {drizzle} from 'drizzle-orm/node-postgres';

import {getDbPool} from '@/app/lib/db/pool';
import * as schema from '@/app/lib/db/schema';

export const db = drizzle(getDbPool(), {schema});
export type Database = typeof db;
export {schema};
export * from '@/app/lib/db/schema';
