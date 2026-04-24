import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {ApisConfig, DataType} from '@/schema/config';

type ParamSource = {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

// Helper to cast value to the declared type
const cast = (value: unknown, type: DataType): unknown => {
  if (value === undefined || value === null) {
    throw new Error('Missing value for parameter');
  }
  switch (type) {
    case 'integer':
      return Math.trunc(Number(value));
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      return Boolean(value);
    case 'string':
      return String(value);
    case 'text':
      return String(value);
    case 'datetime':
      return String(value);
    default:
      return String(value);
  }
};

function interpolateQuery(
  queryTemplate: string,
  {body = {}, params = {}, query = {}}: ParamSource,
): {sql: string; values: unknown[]} {
  const values: unknown[] = [];
  let paramIndex = 1;

  // Single regex to match any of the three magic variable types in order of appearance
  const regex = /(\$\$|@@|&&)([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\1/g;

  const sql = queryTemplate.replace(regex, (_, typeSymbol, name, type) => {
    let val: unknown;

    if (typeSymbol === '$$') {
      val = params[name];
      if (val === undefined) throw new Error(`Missing path param: "${name}"`);
    } else if (typeSymbol === '@@') {
      val = body[name];
      if (val === undefined) throw new Error(`Missing body param: "${name}"`);
    } else if (typeSymbol === '&&') {
      val = query[name];
      if (val === undefined) throw new Error(`Missing query param: "${name}"`);
    }

    values.push(cast(val, type as DataType));
    return `$${paramIndex++}`;
  });

  return {sql, values};
}

export function registerCustomQueryRoutes(
  app: FastifyInstance,
  apis?: ApisConfig,
): void {
  if (!apis || !apis.customQueries) return;

  for (const cq of apis.customQueries) {
    // in magic variables we support 3 types of variables
    // body, path, and query
    const paramsProperties: Record<string, object> = {};
    const queryProperties: Record<string, object> = {};
    const bodyProperties: Record<string, object> = {};

    // body parameters are always in between @@
    // path parameters are always in between $$
    // query parameters are always in between &&
    // each magic variable also contain the type of the variable seperated using :
    // example: @@name:string@@
    const delims = ['@@', '$$', '&&'];
    const foundDelims: {pos: number; type: string}[] = [];

    // here we are detecting all the magic varaibles and their position
    delims.forEach(d => {
      let pos = cq.query.indexOf(d);
      while (pos !== -1) {
        foundDelims.push({pos, type: d});
        pos = cq.query.indexOf(d, pos + 2);
      }
    });

    // ordering it by the position
    foundDelims.sort((a, b) => a.pos - b.pos);

    for (let i = 0; i < foundDelims.length; i += 2) {
      const start = foundDelims[i];
      const end = foundDelims[i + 1];

      if (!end || start.type !== end.type) continue;

      // extracting the variable name and type
      const varString = cq.query.substring(start.pos + 2, end.pos);
      const parts = varString.split(':');

      // skipping parts validation as it is not needed, config validator automatically does it
      const varName = parts[0];
      const varTypeStr = parts[1];

      // building the schema based on the type of the variable and the name of the variable
      // also based on the delimiter type we are adding the schema to the params, query or body
      // if the delimiter is @@ then it is a body parameter
      // if the delimiter is $$ then it is a path parameter
      // if the delimiter is && then it is a query parameter
      const jsonSchema = {
        ...mapDataTypeToJsonSchema(varTypeStr as DataType),
        description: `Custom ${start.type === '@@' ? 'body' : start.type === '&&' ? 'query' : 'path'} parameter`,
      };

      // adding the schema to the params, query or body based on the delimiter type
      if (start.type === '$$') {
        paramsProperties[varName] = jsonSchema;
      } else if (start.type === '&&') {
        queryProperties[varName] = jsonSchema;
      } else if (start.type === '@@') {
        bodyProperties[varName] = jsonSchema;
      }
    }

    // building the schema for the custom query
    const schema: Record<string, unknown> = {
      summary: `Custom Query API: ${cq.path}`,
      description: `Custom endpoint mapped to ${cq.path}`,
      tags: ['Custom Queries'],
    };

    let routePath = `/custom-queries${cq.path.replace(/\/$/, '')}`;
    const paramsKeys = Object.keys(paramsProperties);

    // magic variables are optional, so if we have any magic variable we are adding it to the swagger schema
    if (paramsKeys.length > 0) {
      for (const key of paramsKeys) {
        routePath += `/:${key}`;
      }
      schema.params = {
        type: 'object',
        properties: paramsProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }
    if (Object.keys(queryProperties).length > 0) {
      schema.querystring = {
        type: 'object',
        properties: queryProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }
    if (Object.keys(bodyProperties).length > 0 && cq.method !== 'GET') {
      schema.body = {
        type: 'object',
        properties: bodyProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }

    schema.response = getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {type: 'object', additionalProperties: true},
        },
        res: {type: 'object', additionalProperties: true},
      },
    });

    app.route({
      method: cq.method,
      url: routePath,
      schema,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        // extract the body, path, and query parameters from the request
        const params = request.params as Record<string, unknown>;
        const query = request.query as Record<string, unknown>;
        const body = request.body as Record<string, unknown>;

        const interpolated = interpolateQuery(cq.query, {
          params,
          query,
          body,
        });

        const res = await app.db.query(interpolated.sql, interpolated.values);

        return reply.status(200).send(
          app.buildResponse(200, 'Success', {
            data: res.rows,
            res,
          }),
        );
      },
    });
  }
}
