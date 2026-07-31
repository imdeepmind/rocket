import {normalizeSchemaForAjv} from '@/lib/schema/normalize';
import {mapDataTypeToJsonSchema} from '@/lib/schema/types';

import {ModelBody, ModelConfig} from '@/interfaces/config';

/**
 * Build (or reuse) the JSON schema for a POST body based on the model.
 *
 * Rules for generated schema:
 * - Every field is included in `properties`.
 * - `required` includes fields that are NOT marked `nullable` and have NO `default`.
 * - If `model.validation` is provided, it is used verbatim.
 */
export function generateJSONValidationSchema(
  model: ModelConfig,
  options: {
    ignorePrimaryKey?: boolean;
    additionalProperties?: boolean;
    excludeSecretFields?: boolean;
  } = {},
): Record<string, unknown> {
  if (model.validation) return normalizeSchemaForAjv(model.validation);

  let fields = options.ignorePrimaryKey
    ? Object.entries(model.fields).filter(
        ([, field]) => field.primaryKey !== true,
      )
    : Object.entries(model.fields);

  if (options.excludeSecretFields) {
    fields = fields.filter(([, field]) => !field.secret);
  }

  const bodyProperties: Record<string, object> = {};
  for (const [fieldName, field] of fields) {
    bodyProperties[fieldName] = {
      ...mapDataTypeToJsonSchema(field.type),
      ...(field.type === 'enum' && field.values ? {enum: field.values} : {}),
      description: `Value for ${fieldName}`,
    };
  }

  const required = fields
    .filter(
      ([, field]) => field.nullable !== true && field.default === undefined,
    )
    .map(([fieldName]) => fieldName);

  return {
    type: 'object',
    properties: bodyProperties,
    ...(required.length > 0 ? {required} : {}),
    ...(options.additionalProperties
      ? {additionalProperties: true}
      : {additionalProperties: false}),
  };
}

/**
 * Strip any fields from the request body that are not present in the model.
 */
export function stripAdditionalPostFields(
  model: ModelConfig,
  body: ModelBody,
  options: {ignorePrimaryKey?: boolean} = {},
): ModelBody {
  const allowedFields = options.ignorePrimaryKey
    ? Object.entries(model.fields).filter(
        ([, field]) => field.primaryKey !== true,
      )
    : Object.entries(model.fields);

  const allowed = new Set(allowedFields.map(([name]) => name));
  const filtered: ModelBody = {};

  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}
