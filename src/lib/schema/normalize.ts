import {JsonSchemaObject, JsonSchemaProperty} from '@/interfaces/config';

export function normalizeSchemaForAjv(
  schema: JsonSchemaObject,
): JsonSchemaObject {
  const normalized = JSON.parse(JSON.stringify(schema));
  if (normalized.properties && typeof normalized.properties === 'object') {
    Object.keys(normalized.properties).forEach(key => {
      const prop = (
        normalized.properties as Record<string, JsonSchemaProperty>
      )[key];
      if (prop && (prop.type === 'datetime' || prop.type === 'date-time')) {
        prop.type = 'string';
        prop.format = 'date-time';
      }
      if (prop && prop.type === 'date') {
        prop.type = 'string';
        prop.format = 'date';
      }
    });
  }
  return normalized;
}
