import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  applyFilters,
  buildFilterQueryProperties,
  buildSortQueryProperties,
  generateJSONValidationSchema,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
  paginationQueryProperties,
} from '@/routes/schema-helpers';

import {AppConfig, ModelConfig, ModelFieldConfig} from '@/interfaces/config';

import {enforceSSP} from '@/utils/ssp';
import {capitalizeFirstLetter} from '@/utils/string';
import {callWebhook} from '@/utils/webhook';

/**
 * Register INDEX routes for indexed fields.
 *
 * For each model, for each field with primaryKey, unique, or in an index, creates:
 *   GET /{model}/{columnName}/:value
 *
 * Includes filter query params based on the model's supportedOperations,
 * as well as sorting and pagination, ONLY if the field is not unique.
 */
export function registerIndexRoutes(
  app: FastifyInstance,
  config: AppConfig,
): void {
  // We're iterating over all models provided in the configuration.
  // For each model, we'll check if there are any fields that support the 'indexable' operation.
  const {models} = config;

  for (const model of models) {
    // Determine which fields need an index route
    // a field is considered as indeaxable if it is unique or it is a primary key field
    // or supported operations include indexable
    const indexFields = model.fields.filter(f => {
      return (
        f.primaryKey || f.unique || f.supportedOperations?.includes('indexable')
      );
    });

    // index apis means for these APIs, we can fetch data using the indexable fields
    // for example, if we have a field user_id in the users table, and it is indexed,
    // then we can fetch data using the user_id field like /user/<user_id>
    for (const field of indexFields) {
      // constructing the api identifier
      const apiIdentifier = `modelAPIs->${model.name}->${field.name}->index`;

      // extracting the api configs based on the api identifier
      const webhookConfig = config.apis?.[apiIdentifier]?.webhooks ?? null;
      const sspConfig = config.apis?.[apiIdentifier]?.ssp ?? [];

      // calculating the authroization based on auth flag, it can be true
      // if the api level auth is enabled, or if the app level auth is enabled
      const authorization =
        config.apis?.[apiIdentifier]?.authorization ??
        config.auth?.enableAuth ??
        false;
      const {
        schema,
        isUnique,
      }: {schema: Record<string, unknown>; isUnique: boolean | undefined} =
        generateSchema(field, model, config, authorization);

      app.get(
        `/${model.name}/${field.name}/:${field.name}`,
        {
          schema,
          config: {apiIdentifier},
          preValidation: async (request, reply) => {
            if (config.auth?.enableAuth && authorization) {
              try {
                await request.jwtVerify();
              } catch {
                return reply
                  .status(401)
                  .send(
                    app.buildResponse(
                      401,
                      'Invalid or expired authentication token',
                      null,
                    ),
                  );
              }
            }
            enforceSSP(sspConfig, request);
          },
          preHandler: async request => {
            await callWebhook('request', webhookConfig, request, null, app.log);
          },
          onSend: async (request, _, payload) => {
            await callWebhook(
              'response',
              webhookConfig,
              request,
              payload,
              app.log,
            );
          },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
          // extracting the parameters
          const queryParams = request.query as Record<string, unknown>;
          const params = request.params as Record<string, unknown>;
          const tableName = model.name;

          // building the base SELECT query
          let query = `SELECT * FROM "${tableName}"`;
          const values: unknown[] = [];
          let paramIndex = 1;

          const whereClauses: string[] = [];

          // the base path param condition:
          whereClauses.push(`"${field.name}" = $${paramIndex++}`);
          values.push(params[field.name]);

          // if the indexable field is not unique, then we can apply filters
          // if field unique, no need to apply filters as we only have one data to return
          if (!isUnique) {
            // building the WHERE query
            const {
              whereClauses: filterClauses,
              values: filterValues,
              nextParamIndex,
            } = applyFilters(queryParams, paramIndex);

            whereClauses.push(...filterClauses);
            values.push(...filterValues);
            paramIndex = nextParamIndex;
          }

          // if we have something in where clause, then append it to the base query
          if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          let total = 0;
          if (!isUnique) {
            const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
            const countRes = await app.db.query<{total: number | string}>(
              countQuery,
              values,
            );
            total = Number(countRes.rows[0]?.total || 0);
          }

          // default values for pagination
          let page = 1;
          let limit = 20;

          // if the indexable field is not unique, then we can apply sorting and pagination
          if (!isUnique) {
            // building the ORDER BY query
            if (queryParams.orderBy) {
              query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
            }

            // building the LIMIT and OFFSET query
            page = Math.max(Number(queryParams.page) || 1, 1);
            limit = Math.min(
              Math.max(Number(queryParams.limit) || 20, 10),
              100,
            );
            const offset = (page - 1) * limit;

            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
            values.push(limit, offset);
          } else {
            query += ` LIMIT $${paramIndex++};`;
            values.push(1);
          }

          // executing the query
          const res = await app.db.query(query, values);

          // building the response payload
          const responsePayload: Record<string, unknown> = {
            data: isUnique ? res.rows[0] || null : res.rows || [],
          };

          // injecting the pagination state in the returned response if not unique
          if (!isUnique) {
            responsePayload.pagination = {page, limit, total};
          }

          return reply
            .status(200)
            .send(
              app.buildResponse(
                200,
                `Successfully retrieved records from the ${tableName} table`,
                responsePayload,
                res,
              ),
            );
        },
      );
    }
  }
}

function generateSchema(
  field: ModelFieldConfig,
  model: ModelConfig,
  config: AppConfig,
  authorization: boolean,
) {
  const isUnique = field.primaryKey || field.unique;
  // converting the data type of the indexable field to json schema supported type
  const fieldSchemaType = mapDataTypeToJsonSchema(field.type);

  const queryProperties: Record<string, object> = {};

  // if indexable field is not unque, that means this API can return multiple data records
  // if multiple records are being returned, then we can apply filters, sorting and pagination
  // on the other hand, if the indexable field is unique, then this API can return only one data record
  // hence there is no need to have filtering, or sorting, or pagination
  if (!isUnique) {
    // Add filter params for each field based on its supportedOperations
    for (const f of model.fields) {
      // what is happenign is here is we are building the query parameter names based on the supported operations
      // and the field name so if there is a field called "age" with sopported operations includes lessThanEqual
      // then in the query string, user can pass a query string variable like "age_lte=18"
      // and the value of this variable will be used to filter the data
      // another thing to note is that these fields are optional, users can pass if they want to trigger the filter
      // else they can ignore it
      Object.assign(queryProperties, buildFilterQueryProperties(f));
    }

    // the story is same for storing, if sortable included in the supportedOperations, then bingo, we can sort
    // we supprt two querystring fields, one for the name of the field "orderBy" and another is
    // "orderDir" which can be "asc" or "desc"
    const sortableFields = model.fields
      .filter(f => f.supportedOperations?.includes('sortable'))
      .map(f => f.name);
    Object.assign(queryProperties, buildSortQueryProperties(sortableFields));

    // finally pagination, here users can pass "page" and "limit" as query parameters
    // "page" is the page number and "limit" is the number of records per page
    // default value of "page" is 1 and default value of "limit" is 20
    Object.assign(queryProperties, paginationQueryProperties);
  }

  // now here we are basically generating the JSON schema for the return response
  // based on the model, we can figureout what data we are going to return
  // if say model "user" contains two fields, "id" and "name"
  // then this will generate a schema for the fields "id" and "name"
  // another thing to keep in mind if the unique case
  // if unique, then we return an object
  // else we return an array of objects
  const responseSchemaProperties: Record<string, object> = {
    data: isUnique
      ? {...generateJSONValidationSchema(model), nullable: true}
      : {type: 'array', items: generateJSONValidationSchema(model)},
  };

  // injecting the pagination state in the returned response
  if (!isUnique) {
    responseSchemaProperties.pagination = {
      type: 'object',
      properties: {
        page: {type: 'integer'},
        limit: {type: 'integer'},
        total: {type: 'integer'},
      },
    };
  }

  // here we're configuring the swagger schema for the fastify API
  // it uses the model details to generate the schema
  const schema: Record<string, unknown> = {
    summary: `Get ${capitalizeFirstLetter(model.name)} record(s) by ${field.name}`,
    description: `Get ${model.name} record(s) from the database by ${field.name}`,
    tags: [capitalizeFirstLetter(model.name), 'Read'],
    params: {
      type: 'object',
      properties: {
        // as mentioned earlier, this is the index API, so we will only have one parameter
        // which is the indexable field
        [field.name]: {
          ...fieldSchemaType,
          description: `The ${field.name} value to look up`,
        },
      },
      required: [field.name],
    },
    // here we are generating the schema for the response
    response: getResponseStructureSchema(
      [200],
      {
        type: 'object',
        properties: responseSchemaProperties,
      },
      generateJSONValidationSchema(model),
    ),
  };

  // injecting the query parameters schema
  // as the query string is optional, we are not making it required
  // we are conditionally checking if there is any query parameter
  if (Object.keys(queryProperties).length > 0) {
    schema.querystring = {
      type: 'object',
      properties: queryProperties,
      additionalProperties: false,
    };
  }

  const security: Array<{[key: string]: string[]}> = [];

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'up-auth' &&
    authorization
  ) {
    security.push({bearerAuth: []});
  }

  if (
    config.auth?.enableAuth &&
    config.auth?.authEngine === 'api-key' &&
    authorization
  ) {
    security.push({apiKeyAuth: []});
  }

  if (security.length > 0) {
    schema.security = security;
  }
  return {schema, isUnique};
}
