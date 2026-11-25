import { ResolvedAppConfig } from '../interfaces/config.js';
declare const migrateDatabase: (config: ResolvedAppConfig) => Promise<void>;
export default migrateDatabase;
