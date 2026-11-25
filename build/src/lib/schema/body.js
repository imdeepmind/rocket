import { filterManagedTimestampFields, isManagedTimestampField, MANAGED_TIMESTAMP_FIELDS, } from '../../lib/schema/fields.js';
import { normalizeSchemaForAjv } from '../../lib/schema/normalize.js';
import { mapDataTypeToJsonSchema } from '../../lib/schema/types.js';
/**
 * Build (or reuse) the JSON schema for a POST body based on the model.
 *
 * Rules for generated schema:
 * - Every field is included in `properties`.
 * - `required` includes fields that are NOT marked `nullable` and have NO `default`.
 * - If `model.validation` is provided, it is used verbatim.
 */
export function generateJSONValidationSchema(model, options = {}) {
    if (model.validation) {
        const normalized = normalizeSchemaForAjv(model.validation);
        if (options.excludeTimestamps) {
            stripManagedTimestampProperties(normalized);
        }
        return normalized;
    }
    let fields = options.ignorePrimaryKey
        ? Object.entries(model.fields).filter(([, field]) => field.primaryKey !== true)
        : Object.entries(model.fields);
    if (options.excludeSecretFields) {
        fields = fields.filter(([, field]) => !field.secret);
    }
    if (options.excludeTimestamps) {
        fields = filterManagedTimestampFields(fields);
    }
    const bodyProperties = {};
    for (const [fieldName, field] of fields) {
        bodyProperties[fieldName] = {
            ...mapDataTypeToJsonSchema(field.type),
            ...(field.type === 'enum' && field.values ? { enum: field.values } : {}),
            description: `Value for ${fieldName}`,
        };
    }
    const required = fields
        .filter(([, field]) => field.nullable !== true && field.default === undefined)
        .map(([fieldName]) => fieldName);
    return {
        type: 'object',
        properties: bodyProperties,
        ...(required.length > 0 ? { required } : {}),
        ...(options.additionalProperties
            ? { additionalProperties: true }
            : { additionalProperties: false }),
    };
}
export function stripManagedTimestampProperties(schema) {
    const properties = schema.properties;
    if (properties) {
        for (const name of MANAGED_TIMESTAMP_FIELDS) {
            delete properties[name];
        }
    }
    const required = schema.required;
    if (required) {
        schema.required = required.filter(name => !isManagedTimestampField(name));
    }
}
/**
 * Strip any fields from the request body that are not present in the model.
 */
export function stripAdditionalPostFields(model, body, options = {}) {
    const allowedFields = options.ignorePrimaryKey
        ? Object.entries(model.fields).filter(([, field]) => field.primaryKey !== true)
        : Object.entries(model.fields);
    const allowed = new Set(filterManagedTimestampFields(allowedFields).map(([name]) => name));
    const filtered = {};
    for (const [key, value] of Object.entries(body)) {
        if (allowed.has(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}
//# sourceMappingURL=body.js.map