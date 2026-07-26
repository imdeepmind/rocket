import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  buildSecurityArray,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register DELETE routes for deletable fields.
 *
 * For each model, for each field with 'delete' in apis, creates:
 *   DELETE /{model}/{columnName}/:value
 *
 * Path params: the column value identifying the record to delete.
 */
export function registerDeleteRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;

  for (const [modelName, model] of Object.entries(models)) {
    const deletableFields = Object.entries(model.fields).filter(([, f]) =>
      f.apis?.includes('delete'),
    );

    for (const [fieldName, field] of deletableFields) {
      const apiIdentifier = `model.${modelName}.${fieldName}.delete`;

      if (config.apis?.[apiIdentifier]?.enabled === false) continue;

      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.authentication?.enabled ??
        false;
      const schema: Record<string, unknown> = generateSchema(
        fieldName,
        field,
        model,
        modelName,
        config,
        authorization,
      );

      app.delete(
        `/${modelName}/${fieldName}/:${fieldName}`,
        {
          schema,
          config: {apiIdentifier},
          preValidation: buildPreValidation(app, config, authorization),
          preHandler: async request => {
            await app.callWebhook('request', request, null);
          },
          onSend: async (request, _, payload) => {
            await app.callWebhook('response', request, payload);
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          const {[fieldName]: value} = request.params as Record<
            string,
            unknown
          >;

          const tableName = modelName;
          const columnName = fieldName;

          const query = `DELETE FROM "${tableName}" WHERE "${columnName}" = $1;`;

          await app.db.query(query, [value]);

          return reply.status(204).send();
        },
      );
    }
  }
}

function generateSchema(
  fieldName: string,
  field: ModelFieldConfig,
  model: ModelConfig,
  modelName: string,
  config: AppConfig,
  authorization: boolean,
) {
  const paramSchema = mapDataTypeToJsonSchema(field.type);

  const schema: Record<string, unknown> = {
    summary: `Delete ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
    description: `Delete records from ${capitalizeFirstLetter(modelName)} table where ${fieldName} matches the provided value`,
    tags: [capitalizeFirstLetter(modelName), 'Delete'],
    params: {
      type: 'object',
      properties: {
        [fieldName]: {
          ...paramSchema,
          description: `The ${fieldName} value identifying the record to delete`,
        },
      },
      required: [fieldName],
      additionalProperties: false,
    },
    response: getResponseStructureSchema([204], {}),
  };

  const security = buildSecurityArray(config, authorization);

  if (security.length > 0) {
    schema.security = security;
  }
  return schema;
}
