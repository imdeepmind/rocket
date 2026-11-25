import { ModelBody, ModelConfig } from '../../interfaces/config.js';
/**
 * Build (or reuse) the JSON schema for a POST body based on the model.
 *
 * Rules for generated schema:
 * - Every field is included in `properties`.
 * - `required` includes fields that are NOT marked `nullable` and have NO `default`.
 * - If `model.validation` is provided, it is used verbatim.
 */
export declare function generateJSONValidationSchema(model: ModelConfig, options?: {
    ignorePrimaryKey?: boolean;
    additionalProperties?: boolean;
    excludeSecretFields?: boolean;
    excludeTimestamps?: boolean;
}): Record<string, unknown>;
export declare function stripManagedTimestampProperties(schema: Record<string, unknown>): void;
/**
 * Strip any fields from the request body that are not present in the model.
 */
export declare function stripAdditionalPostFields(model: ModelConfig, body: ModelBody, options?: {
    ignorePrimaryKey?: boolean;
}): ModelBody;
