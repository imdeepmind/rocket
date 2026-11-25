import { DataType, ModelConfig, ModelFieldConfig } from '../../interfaces/config.js';
/**
 * Return field entries excluding secret fields unless bypassSecret is true.
 */
export declare function getPublicFields(model: ModelConfig, bypassSecret?: boolean): [string, ModelFieldConfig][];
/**
 * Map config DataType to JSON Schema type definition for Swagger.
 */
export declare function mapDataTypeToJsonSchema(type: DataType): {
    type: string;
    format?: string;
};
