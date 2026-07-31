import {ModelFieldConfig} from '@/interfaces/config';

export const MANAGED_TIMESTAMP_FIELDS = ['created_at', 'updated_at'];

export function isManagedTimestampField(fieldName: string): boolean {
  return MANAGED_TIMESTAMP_FIELDS.includes(fieldName);
}

export function filterManagedTimestampFields(
  fields: Array<[string, ModelFieldConfig]>,
): Array<[string, ModelFieldConfig]> {
  return fields.filter(([name]) => !isManagedTimestampField(name));
}
