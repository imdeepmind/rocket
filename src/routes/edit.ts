import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { ModelConfig, ModelBody } from '../schema/config';
import {
  mapDataTypeToJsonSchema,
  buildFilterQueryProperties,
  getResponseStructureSchema,
  stripAdditionalPostFields,
  buildPostBodyValidationSchema,
} from './schema-helpers';
import { capitalizeFirstLetter } from '../utils/string';

/**
 * Register EDIT routes for editable fields.
 *
 * For each model, for each field with 'editable' in supportedOperations, creates:
 *   PATCH /{model}/{columnName}/:value (partial update)
 *   PUT /{model}/{columnName}/:value (complete update)
 *
 * Path params: the column value identifying the record to edit.
 * Body: all other fields as properties for updating.
 * Filters: if the field is not unique, filter params are available.
 */
export function registerEditRoutes(app: FastifyInstance, models: ModelConfig[]): void {
  for (const model of models) {
    const editableFields = model.fields.filter((f) => f.supportedOperations?.includes('editable'));

    for (const field of editableFields) {
      const isUnique = field.primaryKey || field.unique;
      const paramSchema = mapDataTypeToJsonSchema(field.type);

      const queryProperties: Record<string, object> = {};
      if (!isUnique) {
        // Add filter params for each field based on its supportedOperations
        for (const f of model.fields) {
          Object.assign(queryProperties, buildFilterQueryProperties(f));
        }
      }

      // Body contains all other fields as update targets
      const bodyProperties: Record<string, object> = {};
      const allBodyFieldNames: string[] = [];

      for (const otherField of model.fields) {
        if (otherField.name === field.name) continue;
        bodyProperties[otherField.name] = {
          ...mapDataTypeToJsonSchema(otherField.type),
          description: `Updated value for ${otherField.name}`,
        };
        allBodyFieldNames.push(otherField.name);
      }

      const buildRouteSchema = (method: 'PATCH' | 'PUT') => {
        const schema: Record<string, unknown> = {
          summary: `${method === 'PATCH' ? 'Partial' : 'Complete'} edit of ${capitalizeFirstLetter(model.name)} record(s) by ${field.name}`,
          description: `${method} update on records from the database by ${field.name}`,
          tags: [capitalizeFirstLetter(model.name), 'Update'],
          params: {
            type: 'object',
            properties: {
              [field.name]: {
                ...paramSchema,
                description: `The ${field.name} value identifying the record to edit`,
              },
            },
            required: [field.name],
          },
          body: {
            type: 'object',
            properties: bodyProperties,
            required: method === 'PUT' ? allBodyFieldNames : [],
          },
          response: getResponseStructureSchema(
            [200],
            buildPostBodyValidationSchema(model),
            buildPostBodyValidationSchema(model)
          ),
        };

        if (Object.keys(queryProperties).length > 0) {
          schema.querystring = {
            type: 'object',
            properties: queryProperties,
          };
        }

        return schema;
      };

      const handleEditRequest = async (request: FastifyRequest, reply: FastifyReply) => {
        const queryParams = request.query as Record<string, unknown>;
        const params = request.params as Record<string, unknown>;
        const tableName = model.name;

        // Strip unexpected fields from body
        const incomingBody = request.body as ModelBody;
        const body = stripAdditionalPostFields(model, incomingBody);

        // Remove the identifying field from the body if it was mistakenly provided
        delete body[field.name];

        const keys = Object.keys(body);
        if (keys.length === 0) {
          return reply.status(400).send({ error: 'No fields provided for update' });
        }

        const values: unknown[] = [];
        let paramIndex = 1;

        const setClauses: string[] = [];
        for (const key of keys) {
          setClauses.push(`"${key}" = $${paramIndex++}`);
          values.push(body[key]);
        }

        const whereClauses: string[] = [];
        // The base path param condition:
        whereClauses.push(`"${field.name}" = $${paramIndex++}`);
        values.push(params[field.name]);

        if (!isUnique) {
          // Filters
          for (const key of Object.keys(queryParams)) {
            if (['page', 'limit', 'orderBy', 'orderDir'].includes(key)) continue;

            if (key.endsWith('_eq')) {
              whereClauses.push(`"${key.replace('_eq', '')}" = $${paramIndex++}`);
              values.push(queryParams[key]);
            } else if (key.endsWith('_lt')) {
              whereClauses.push(`"${key.replace('_lt', '')}" < $${paramIndex++}`);
              values.push(queryParams[key]);
            } else if (key.endsWith('_lte')) {
              whereClauses.push(`"${key.replace('_lte', '')}" <= $${paramIndex++}`);
              values.push(queryParams[key]);
            } else if (key.endsWith('_gt')) {
              whereClauses.push(`"${key.replace('_gt', '')}" > $${paramIndex++}`);
              values.push(queryParams[key]);
            } else if (key.endsWith('_gte')) {
              whereClauses.push(`"${key.replace('_gte', '')}" >= $${paramIndex++}`);
              values.push(queryParams[key]);
            } else if (key.endsWith('_in')) {
              const inValues = String(queryParams[key]).split(',');
              const inParams = inValues.map(() => `$${paramIndex++}`).join(', ');
              whereClauses.push(`"${key.replace('_in', '')}" IN (${inParams})`);
              values.push(...inValues);
            }
          }
        }

        const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

        const res = await app.db.query(query, values);

        return reply
          .status(200)
          .send(
            app.buildResponse(
              200,
              `Successfully updated records in the ${tableName} table`,
              body,
              res
            )
          );
      };

      app.patch(
        `/${model.name}/${field.name}/:${field.name}`,
        { schema: buildRouteSchema('PATCH') },
        handleEditRequest
      );

      app.put(
        `/${model.name}/${field.name}/:${field.name}`,
        { schema: buildRouteSchema('PUT') },
        handleEditRequest
      );
    }
  }
}
