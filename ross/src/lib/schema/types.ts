import {DataType, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

/**
 * Return field entries excluding secret fields unless bypassSecret is true.
 */
export function getPublicFields(
  model: ModelConfig,
  bypassSecret?: boolean,
): [string, ModelFieldConfig][] {
  return Object.entries(model.fields).filter(
    ([, f]) => bypassSecret || !f.secret,
  );
}

/**
 * Map config DataType to JSON Schema type definition for Swagger.
 */
export function mapDataTypeToJsonSchema(type: DataType): {
  type: string;
  format?: string;
} {
  switch (type) {
    case 'integer':
      return {type: 'integer'};
    case 'string':
      return {type: 'string'};
    case 'boolean':
      return {type: 'boolean'};
    case 'text':
      return {type: 'string'};
    case 'datetime':
      return {type: 'string', format: 'date-time'};
    case 'date':
      return {type: 'string', format: 'date'};
    case 'decimal':
      return {type: 'number'};
    case 'json':
      return {type: 'object'};
    case 'enum':
    case 'uuid':
    case 'ulid':
      return {type: 'string'};
    default:
      return {type: 'string'};
  }
}
