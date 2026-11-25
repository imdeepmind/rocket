import { AppConfig, ResolvedAppConfig } from '../../interfaces/config.js';
export declare function validateConfig<T extends AppConfig | ResolvedAppConfig>(input: T): T;
