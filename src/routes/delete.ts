import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {ModelConfig} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register DELETE routes for deletable fields.
 *
 * For each model, for each field with 'deletable' in supportedOperations, creates:
 *   DELETE /{model}/{columnName}/:value
 *
 * Path params: the column value identifying the record to delete.
 */
export function registerDeleteRoutes(
  app: FastifyInstance,
  models: ModelConfig[],
): void {
  for (const model of models) {
    const deletableFields = model.fields.filter(f =>
      f.supportedOperations?.includes('deletable'),
    );

    for (const field of deletableFields) {
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      app.delete(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema: {
            summary: `Delete ${capitalizeFirstLetter(model.name)} records by ${field.name}`,
            description: `Delete records from ${capitalizeFirstLetter(model.name)} table where ${field.name} matches the provided value`,
            tags: [capitalizeFirstLetter(model.name), 'Delete'],
            params: {
              type: 'object',
              properties: {
                [field.name]: {
                  ...paramSchema,
                  description: `The ${field.name} value identifying the record to delete`,
                },
              },
              required: [field.name],
            },
            response: getResponseStructureSchema([204], {}),
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          const {[field.name]: value} = request.params as Record<
            string,
            unknown
          >;
          const tableName = model.name;
          const columnName = field.name;

          const query = `DELETE FROM "${tableName}" WHERE "${columnName}" = $1;`;

          await app.db.query(query, [value]);

          return reply.status(204).send();
        },
      );
    }
  }
}
