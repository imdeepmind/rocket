import { ModelFieldConfig } from '../../interfaces/config.js';
export declare const MANAGED_TIMESTAMP_FIELDS: string[];
export declare function isManagedTimestampField(fieldName: string): boolean;
export declare function filterManagedTimestampFields(fields: Array<[string, ModelFieldConfig]>): Array<[string, ModelFieldConfig]>;
